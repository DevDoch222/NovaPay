# NovaPay API (apps/api)

Phase 0 modular monolith. Domain modules are stubs until Phase 1.

## Commands

```bash
cp ../../.env.example .env   # or edit the generated .env
# set Supabase DATABASE_URL + DATABASE_URL_DIRECT

docker compose -f ../../docker-compose.yml up -d redis

npm run start:dev
```

- `GET /health/live` — process up
- `GET /health` — Postgres + Redis checks

## Database

Drizzle ORM against Supabase Postgres.

```bash
npm run db:generate   # from schema.ts
npm run db:push       # push schema (dev)
npm run db:migrate    # apply migrations
npm run db:studio     # Drizzle Studio
```

Use the **pooler** URL for the app (`DATABASE_URL`, port `6543`, `prepare: false`).
Use the **direct** URL for migrations (`DATABASE_URL_DIRECT`, port `5432`).
