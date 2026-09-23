import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import { users } from '../../database/schema';

/**
 * NDPR retention stub: redact PII for closed accounts.
 * Full archival / hard-delete to cold storage is Phase 8+.
 */
@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async purgeClosedUser(userId: string) {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.status !== 'closed') {
      throw new BadRequestException(
        'User must be status=closed before NDPR purge',
      );
    }

    const [row] = await this.db
      .update(users)
      .set({
        phone: `purged:${userId.slice(0, 8)}`,
        email: null,
        tag: null,
        avatarUrl: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    this.logger.log(`NDPR purge stub applied to user=${userId}`);
    return {
      ok: true,
      userId: row.id,
      status: row.status,
      phone: row.phone,
      note: 'PII redacted. Ledger history retained for financial recordkeeping.',
    };
  }
}
