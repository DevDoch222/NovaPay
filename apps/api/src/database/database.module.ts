import {
  Global,
  Inject,
  Injectable,
  Module,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { Env } from '../config/env.validation';
import * as schema from './schema';

export const DRIZZLE = Symbol('DRIZZLE');
export const POSTGRES_CLIENT = Symbol('POSTGRES_CLIENT');

export type Database = PostgresJsDatabase<typeof schema>;

@Injectable()
export class DatabaseLifecycle implements OnModuleDestroy {
  constructor(
    @Inject(POSTGRES_CLIENT)
    private readonly client: ReturnType<typeof postgres>,
  ) {}

  async onModuleDestroy() {
    await this.client.end({ timeout: 5 });
  }
}

@Global()
@Module({
  providers: [
    {
      provide: POSTGRES_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const url = config.get('DATABASE_URL', { infer: true });
        return postgres(url, {
          max: 10,
          prepare: false, // required for Supabase pooler (PgBouncer) connections
        });
      },
    },
    {
      provide: DRIZZLE,
      inject: [POSTGRES_CLIENT],
      useFactory: (client: ReturnType<typeof postgres>) =>
        drizzle(client, { schema }),
    },
    DatabaseLifecycle,
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule {}
