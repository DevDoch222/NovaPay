import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { GlobalExceptionFilter } from './../src/common/filters/global-exception.filter';

/**
 * Full AppModule e2e needs Supabase + Redis.
 * Health uses the Nest TestingModule. Auth/payments live smoke hits a
 * running API — see `auth-payments.e2e-spec.ts`.
 *
 * Phase 0 CI only runs unit tests + build; run this locally when infra is up:
 *   docker compose up -d redis
 *   # set apps/api/.env with Supabase URLs
 *   npm run test:e2e
 */
describe('HealthController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
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

  afterEach(async () => {
    await app.close();
  });

  it('/health/live (GET)', async () => {
    const res = await request(app.getHttpServer())
      .get('/health/live')
      .expect(200);
    const body = res.body as { status: string; phase: number };
    expect(body.status).toBe('ok');
    expect(body.phase).toBe(6);
  });
});
