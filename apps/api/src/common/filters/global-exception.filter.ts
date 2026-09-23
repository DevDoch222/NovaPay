import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiErrorCode, type ApiErrorCodeValue } from '../api/error-codes';
import type { ApiErrorResponse } from '../api/api.types';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const { status, body } = this.normalize(exception);

    if (status >= 500) {
      this.logger.error(
        body.error.message,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json(body);
  }

  private normalize(exception: unknown): {
    status: number;
    body: ApiErrorResponse;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const { message, details } = this.extractHttpPayload(payload);
      const code = this.codeFromStatus(status, message);

      return {
        status,
        body: this.errorBody(code, message, details),
      };
    }

    const dbMessage =
      exception instanceof Error ? exception.message : String(exception);
    if (this.isDatabaseError(dbMessage)) {
      return {
        status: HttpStatus.CONFLICT,
        body: this.errorBody(
          ApiErrorCode.DATABASE_ERROR,
          'Database operation failed',
          process.env.NODE_ENV === 'development' ? dbMessage : undefined,
        ),
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: this.errorBody(
        ApiErrorCode.INTERNAL_ERROR,
        'Internal server error',
        process.env.NODE_ENV === 'development' ? dbMessage : undefined,
      ),
    };
  }

  private extractHttpPayload(payload: string | object): {
    message: string;
    details?: unknown;
  } {
    if (typeof payload === 'string') {
      return { message: payload };
    }

    const obj = payload as Record<string, unknown>;
    const message = this.formatMessage(obj.message ?? obj.error);
    const details = obj.details ?? obj.errors ?? obj.message;

    return {
      message,
      details:
        Array.isArray(details) || typeof details === 'object'
          ? details
          : undefined,
    };
  }

  private formatMessage(value: unknown): string {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
      return value
        .map((item) =>
          typeof item === 'string'
            ? item
            : typeof item === 'object' && item && 'message' in item
              ? String((item as { message: unknown }).message)
              : JSON.stringify(item),
        )
        .join('; ');
    }
    if (value && typeof value === 'object' && 'message' in value) {
      return String(value.message);
    }
    return 'Request failed';
  }

  private codeFromStatus(status: number, message: string): ApiErrorCodeValue {
    if (status === 429) {
      return ApiErrorCode.RATE_LIMITED;
    }
    if (status === 400 && message.toLowerCase().includes('validation')) {
      return ApiErrorCode.VALIDATION_ERROR;
    }

    switch (status) {
      case 400:
        return ApiErrorCode.VALIDATION_ERROR;
      case 401:
        return ApiErrorCode.UNAUTHORIZED;
      case 403:
        return ApiErrorCode.FORBIDDEN;
      case 404:
        return ApiErrorCode.NOT_FOUND;
      case 409:
        return ApiErrorCode.CONFLICT;
      default:
        return ApiErrorCode.INTERNAL_ERROR;
    }
  }

  private isDatabaseError(message: string): boolean {
    return (
      message.includes('duplicate key') ||
      message.includes('_uidx') ||
      message.includes('violates foreign key') ||
      message.includes('violates not-null') ||
      message.includes('could not serialize access') ||
      message.includes('connection terminated') ||
      message.includes('ECONNREFUSED')
    );
  }

  private errorBody(
    code: ApiErrorCodeValue,
    message: string,
    details?: unknown,
  ): ApiErrorResponse {
    return {
      success: false,
      message,
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
      },
    };
  }
}
