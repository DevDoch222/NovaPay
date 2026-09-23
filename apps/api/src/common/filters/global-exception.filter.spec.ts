import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';
import { ApiErrorCode } from '../api/error-codes';

describe('GlobalExceptionFilter', () => {
  const filter = new GlobalExceptionFilter();

  function run(exception: unknown) {
    const json = jest.fn<void, [Record<string, unknown>]>();
    filter.catch(exception, {
      switchToHttp: () => ({
        getResponse: () => ({ status: jest.fn().mockReturnThis(), json }),
      }),
    } as never);
    const payload = json.mock.calls[0]?.[0];
    if (!payload) throw new Error('filter did not write response');
    return payload as {
      success: boolean;
      message: string;
      error: { code: string; message: string; details?: unknown };
    };
  }

  it('formats HttpException with error code', () => {
    const body = run(new BadRequestException('Invalid amount'));
    expect(body.success).toBe(false);
    expect(body.message).toBe('Invalid amount');
    expect(body.error.code).toBe(ApiErrorCode.VALIDATION_ERROR);
  });

  it('maps not found to NOT_FOUND', () => {
    const body = run(new HttpException('Missing', HttpStatus.NOT_FOUND));
    expect(body.error.code).toBe(ApiErrorCode.NOT_FOUND);
  });

  it('maps unknown errors to INTERNAL_ERROR', () => {
    const body = run(new Error('boom'));
    expect(body.error.code).toBe(ApiErrorCode.INTERNAL_ERROR);
  });

  it('maps duplicate key database errors to DATABASE_ERROR', () => {
    const body = run(
      new Error(
        'duplicate key value violates transactions_idempotency_key_uidx',
      ),
    );
    expect(body.error.code).toBe(ApiErrorCode.DATABASE_ERROR);
  });
});
