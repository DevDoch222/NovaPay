import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { INestApplication } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation';

export function setupSwagger(
  app: INestApplication,
  config: ConfigService<Env, true>,
) {
  const enabled = config.get('SWAGGER_ENABLED', { infer: true }) === 'true';
  if (!enabled) return;

  const doc = new DocumentBuilder()
    .setTitle('NovaPay API')
    .setDescription(
      'Cross-border multi-currency digital banking platform. Phase 5 adds standardized errors, pagination, idempotency headers, and rate limiting.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'Authorization',
        description: 'Bearer JWT or API key',
      },
      'bearer',
    )
    .addTag('auth', 'OTP, JWT, profile, KYC')
    .addTag('wallets', 'Multi-currency wallets')
    .addTag('payments', 'Fund, payout, beneficiaries, transactions')
    .addTag('fx', 'FX rates and quotes')
    .addTag('cards', 'Virtual cards')
    .addTag('receive', 'Virtual receiving accounts')
    .addTag('bills', 'Bills and airtime')
    .addTag('business', 'Organizations and bulk payouts')
    .addTag('stablecoins', 'Stablecoin deposit and convert')
    .addTag('developer', 'API keys and webhooks')
    .addTag('fees', 'Fee quotes')
    .addTag('reconciliation', 'Ledger vs Flutterwave reconciliation')
    .addTag('compliance', 'KYC limits, AML alerts, card disputes, retention')
    .addTag('admin', 'Platform admin ops console APIs')
    .addTag('support', 'Customer support tickets')
    .addTag('health', 'Health checks')
    .build();

  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, doc), {
    swaggerOptions: { persistAuthorization: true },
  });
}
