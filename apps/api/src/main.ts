import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import type { Env } from './config/env.validation';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { setupSwagger } from './common/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));
  app.enableCors({ origin: true, credentials: true });
  app.enableShutdownHooks();
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = app.get(ConfigService<Env, true>);
  setupSwagger(app, config);

  const port = config.get('PORT', { infer: true });
  const name = config.get('APP_NAME', { infer: true });

  await app.listen(port, '0.0.0.0');
  app.get(Logger).log(`${name} listening on :${port}`, 'Bootstrap');
  if (config.get('SWAGGER_ENABLED', { infer: true }) === 'true') {
    app
      .get(Logger)
      .log(`Swagger UI at http://localhost:${port}/docs`, 'Bootstrap');
  }
}

void bootstrap();
