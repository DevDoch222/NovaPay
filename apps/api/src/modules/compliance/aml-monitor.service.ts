import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import { complianceAlerts } from '../../database/schema';
import type { Env } from '../../config/env.validation';

@Injectable()
export class AmlMonitorService {
  private readonly logger = new Logger(AmlMonitorService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly config: ConfigService<Env, true>,
  ) {}

  largeAmountThresholdMinor() {
    return BigInt(
      this.config.get('AML_LARGE_AMOUNT_MINOR', { infer: true }),
    );
  }

  async flag(input: {
    userId?: string | null;
    transactionId?: string | null;
    ruleName: string;
    severity?: string;
    description: string;
    metadata?: Record<string, unknown>;
  }) {
    this.logger.warn(
      `AML alert [${input.ruleName}] ${input.description} user=${input.userId ?? 'n/a'}`,
    );
    const [row] = await this.db
      .insert(complianceAlerts)
      .values({
        userId: input.userId ?? null,
        transactionId: input.transactionId ?? null,
        ruleName: input.ruleName,
        severity: input.severity ?? 'medium',
        description: input.description,
        metadata: input.metadata ?? {},
        status: 'open',
      })
      .returning();
    return row;
  }

  async maybeFlagLargeAmount(input: {
    userId: string;
    amountMinor: bigint;
    currency: string;
    direction: 'inbound' | 'outbound';
    transactionId?: string;
  }) {
    const threshold = this.largeAmountThresholdMinor();
    if (input.amountMinor < threshold) {
      return null;
    }
    return this.flag({
      userId: input.userId,
      transactionId: input.transactionId,
      ruleName: 'large_amount',
      severity: 'high',
      description: `Large ${input.direction} ${input.amountMinor.toString()} ${input.currency}`,
      metadata: {
        amountMinor: input.amountMinor.toString(),
        currency: input.currency,
        direction: input.direction,
        thresholdMinor: threshold.toString(),
      },
    });
  }

  async listAlerts(status?: string, page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    const where =
      status &&
      ['open', 'under_review', 'dismissed', 'confirmed'].includes(status)
        ? eq(
            complianceAlerts.status,
            status as 'open' | 'under_review' | 'dismissed' | 'confirmed',
          )
        : undefined;

    const items = await this.db.query.complianceAlerts.findMany({
      where,
      orderBy: [desc(complianceAlerts.createdAt)],
      limit,
      offset,
    });

    return items.map((a) => ({
      ...a,
      metadata: a.metadata ?? {},
    }));
  }

  async updateAlert(
    id: string,
    status: 'open' | 'under_review' | 'dismissed' | 'confirmed',
  ) {
    const [row] = await this.db
      .update(complianceAlerts)
      .set({ status, updatedAt: new Date() })
      .where(eq(complianceAlerts.id, id))
      .returning();
    return row;
  }

  async openAlertCount(userId: string) {
    const rows = await this.db.query.complianceAlerts.findMany({
      where: and(
        eq(complianceAlerts.userId, userId),
        inArray(complianceAlerts.status, ['open', 'under_review']),
      ),
      columns: { id: true },
    });
    return rows.length;
  }
}
