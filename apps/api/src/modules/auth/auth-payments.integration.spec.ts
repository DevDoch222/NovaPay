import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Injectable,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PaymentsController } from '../payments/payments.controller';
import { PaymentsService } from '../payments/payments.service';
import { GlobalExceptionFilter } from '../../common/filters/global-exception.filter';
import { ApiErrorCode } from '../../common/api/error-codes';
import { IS_PUBLIC_KEY, type AuthUser } from '../../common/decorators';

type ErrorBody = {
  success: boolean;
  message: string;
  error: { code: string; message: string };
};

@Injectable()
class TestAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: AuthUser;
    }>();
    if (!req.headers.authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    req.user = {
      userId: '11111111-1111-1111-1111-111111111111',
      phone: '+2348012345678',
      kycTier: 'tier_1',
      authType: 'jwt',
    };
    return true;
  }
}

/**
 * Lightweight HTTP integration tests for Phase 5 auth + payments contracts.
 * Does not require Postgres/Redis — services are mocked.
 */
describe('Auth + Payments contracts (integration)', () => {
  let app: INestApplication<App>;
  const authService = {
    requestOtp: jest.fn(),
    verifyOtp: jest.fn(),
    refresh: jest.fn(),
    me: jest.fn(),
    updateProfile: jest.fn(),
    submitKyc: jest.fn(),
  };
  const paymentsService = {
    getRailName: jest.fn().mockReturnValue('mock'),
    listNgBanks: jest.fn(),
    createBeneficiary: jest.fn(),
    listBeneficiaries: jest.fn(),
    fundWallet: jest.fn(),
    simulateFundComplete: jest.fn(),
    payout: jest.fn(),
    listTransactions: jest.fn(),
    getTransaction: jest.fn(),
    handleFlutterwaveWebhook: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController, PaymentsController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: PaymentsService, useValue: paymentsService },
        Reflector,
        { provide: APP_GUARD, useClass: TestAuthGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('error envelope', () => {
    it('returns standardized body for invalid OTP payload', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/otp/request')
        .send({ phone: 'not-e164' })
        .expect(400);

      const body = res.body as ErrorBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ApiErrorCode.VALIDATION_ERROR);
      expect(typeof body.message).toBe('string');
    });

    it('returns UNAUTHORIZED when auth service rejects OTP', async () => {
      authService.verifyOtp.mockRejectedValue(
        new UnauthorizedException('Invalid or expired OTP'),
      );

      const res = await request(app.getHttpServer())
        .post('/v1/auth/otp/verify')
        .send({ phone: '+2348012345678', code: '000000' })
        .expect(401);

      expect(res.body as ErrorBody).toMatchObject({
        success: false,
        message: 'Invalid or expired OTP',
        error: { code: ApiErrorCode.UNAUTHORIZED },
      });
    });

    it('returns UNAUTHORIZED for protected routes without token', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/transactions')
        .expect(401);

      const body = res.body as ErrorBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ApiErrorCode.UNAUTHORIZED);
    });
  });

  describe('auth happy path', () => {
    it('requests and verifies OTP', async () => {
      authService.requestOtp.mockResolvedValue({
        phone: '+2348012345678',
        expiresInSeconds: 300,
        devCode: '000000',
      });
      authService.verifyOtp.mockResolvedValue({
        accessToken: 'access',
        refreshToken: 'refresh',
        user: { id: '11111111-1111-1111-1111-111111111111' },
      });

      const otp = await request(app.getHttpServer())
        .post('/v1/auth/otp/request')
        .send({ phone: '+2348012345678' })
        .expect(201);

      expect((otp.body as { devCode: string }).devCode).toBe('000000');

      const verify = await request(app.getHttpServer())
        .post('/v1/auth/otp/verify')
        .send({ phone: '+2348012345678', code: '000000' })
        .expect(201);

      expect((verify.body as { accessToken: string }).accessToken).toBe(
        'access',
      );
      expect(authService.verifyOtp).toHaveBeenCalledWith(
        '+2348012345678',
        '000000',
      );
    });
  });

  describe('payments pagination', () => {
    it('lists transactions with page/limit and paginated envelope', async () => {
      paymentsService.listTransactions.mockResolvedValue({
        items: [{ id: 'txn-1', type: 'fund', status: 'completed' }],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      });

      const res = await request(app.getHttpServer())
        .get('/v1/transactions?page=1&limit=20')
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      const body = res.body as {
        items: unknown[];
        pagination: { page: number; limit: number; total: number };
      };
      expect(body.items).toHaveLength(1);
      expect(body.pagination).toMatchObject({
        page: 1,
        limit: 20,
        total: 1,
      });
      expect(paymentsService.listTransactions).toHaveBeenCalledWith(
        '11111111-1111-1111-1111-111111111111',
        1,
        20,
      );
    });

    it('lists beneficiaries with pagination query defaults', async () => {
      paymentsService.listBeneficiaries.mockResolvedValue({
        items: [],
        pagination: {
          page: 1,
          limit: 50,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      });

      await request(app.getHttpServer())
        .get('/v1/beneficiaries')
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      expect(paymentsService.listBeneficiaries).toHaveBeenCalledWith(
        '11111111-1111-1111-1111-111111111111',
        1,
        50,
      );
    });

    it('rejects invalid pagination limit', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/transactions?page=1&limit=500')
        .set('Authorization', 'Bearer test-token')
        .expect(400);

      const body = res.body as ErrorBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ApiErrorCode.VALIDATION_ERROR);
    });

    it('funds wallet and returns service payload', async () => {
      paymentsService.fundWallet.mockResolvedValue({
        id: 'fund-1',
        status: 'pending',
      });

      const res = await request(app.getHttpServer())
        .post('/v1/payments/fund')
        .set('Authorization', 'Bearer test-token')
        .send({
          amountMajor: 1000,
          currency: 'NGN',
          idempotencyKey: 'fund-test-key-01',
        })
        .expect(201);

      expect((res.body as { id: string }).id).toBe('fund-1');
      expect(paymentsService.fundWallet).toHaveBeenCalled();
    });
  });
});
