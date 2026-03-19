# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ayala Land Collections & Payments Portal — a Next.js 16 fullstack application for managing Accounts Receivable (AR) and Accounts Payable (AP) operations. Deployed on Vercel at mpe-payments-demo.vercel.app.

## Repository Structure

```
/app          → Next.js 16 application (primary codebase)
/infra        → AWS CDK infrastructure (Lambda + ML pipeline deployment)
/ml_pipeline  → Python ML pipeline (segmentation, credit risk, churn, demand forecast)
/supabase     → Supabase Edge Functions (sql-proxy for DB access)
```

## Commands

All commands run from `/app`:

```bash
npm run dev          # Dev server at localhost:3000
npm run build        # Production build
npm run lint         # ESLint
```

No test framework is configured.

### Pushing Schema Changes

`drizzle-kit push` does NOT work from this environment (WSL2 cannot reach the Supabase direct PostgreSQL host over IPv6). Instead, push DDL through the SQL proxy:

```bash
curl -s -X POST "$SUPABASE_SQL_PROXY_URL" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $SUPABASE_SQL_PROXY_KEY" \
  -d '{"sql":"<DDL STATEMENT HERE>","params":[],"method":"execute"}'
```

For schema changes, write the raw SQL (CREATE TABLE, ALTER TABLE, CREATE INDEX) and execute each statement via the proxy. Example:

```bash
# Create a new table
curl -s -X POST "$SUPABASE_SQL_PROXY_URL" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $SUPABASE_SQL_PROXY_KEY" \
  -d '{"sql":"CREATE TABLE IF NOT EXISTS my_table_col (id SERIAL PRIMARY KEY, name VARCHAR(200) NOT NULL);","params":[],"method":"execute"}'

# Add a column to an existing table
curl -s -X POST "$SUPABASE_SQL_PROXY_URL" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $SUPABASE_SQL_PROXY_KEY" \
  -d '{"sql":"ALTER TABLE my_table_col ADD COLUMN IF NOT EXISTS new_col TEXT;","params":[],"method":"execute"}'
```

The env vars `SUPABASE_SQL_PROXY_URL` and `SUPABASE_SQL_PROXY_KEY` are in `/app/.env`. Always use `IF NOT EXISTS` / `IF EXISTS` for idempotency.

## Tech Stack

- **Frontend**: React 19, Redux Toolkit, Tailwind CSS, Radix UI, Recharts
- **Backend**: Next.js App Router API routes
- **Database**: PostgreSQL (Supabase) accessed via Drizzle ORM through a Supabase Edge Function SQL proxy (`/supabase/functions/sql-proxy`)
- **Auth**: Firebase (Google Sign-In on client, Firebase Admin SDK verification on server)
- **Payments**: Stripe (PHP currency)
- **AI**: Google Gemini 2.5-Flash — agentic chat with function-calling SQL queries, document OCR via Gemini Vision
- **ML**: Local TypeScript pipeline (`/app/src/lib/ml-local.ts`) + Python pipeline (`/ml_pipeline`)

## Architecture

### Database Access Pattern

The app does NOT connect to PostgreSQL directly. All queries go through a Supabase Edge Function (`sql-proxy`) that accepts SQL via HTTP. The Drizzle ORM client in `/app/src/db/index.ts` uses `drizzle(async (sql, params, method) => { ... })` to proxy queries through this endpoint. This means:
- `SUPABASE_SQL_PROXY_URL` and `SUPABASE_SQL_PROXY_KEY` are required env vars
- `DATABASE_URL` is only used by `drizzle-kit` for migrations, not at runtime
- Query results from pg-proxy may have double-encoded JSONB — the codebase handles this

### Authentication Flow

1. Client: Firebase Google Sign-In → gets ID token
2. Client sends `Authorization: Bearer <token>` on all API requests
3. Server: `withAuth()` middleware in `/app/src/lib/auth-middleware.ts` verifies via Firebase Admin SDK
4. Protected routes use `withAuth(handler)` wrapper

### State Management

Redux Toolkit with slices: `nav`, `chat`, `dashboard`, `receivable`, `payable`, `collections`, `emulator`. Store in `/app/src/store/`.

### Schema

Drizzle schema in `/app/src/db/schema.ts` (~30 tables). All table names end with `_col` suffix. Key domains:
- **AR**: `customers_col`, `contracts_col`, `invoices_col`, `incoming_payments_col`, `qr_codes_col`
- **AP**: `suppliers_col`, `purchase_orders_col`, `goods_receipts_col`, `supplier_invoices_col`, `outgoing_payments_col`, `three_way_matches_col`
- **ML**: `payer_segments_col`, `delinquency_scores_col`, `credit_risk_scores_col`, `payment_patterns_col`, `cash_flow_forecasts_col`, `insight_cards_col`
- **Documents/Escalations**: `documents_col`, `escalations_col`

### Data Seeding

`seedDatabase()` in `/app/src/lib/seed.ts` populates demo data: 30 tenants across Ayala Land properties, 20 suppliers, 6 months of invoices/payments, ML scores. Uses deterministic PRNG (seed=42). Triggered via `POST /api/seed` or the settings UI.

### AI Chat

Gemini chat in `/app/src/lib/gemini.ts` uses function calling to execute read-only SQL queries against the database. System prompt includes the full schema. Limited to 5 queries per turn.

### Cron

`vercel.json` configures a daily cron at 22:00 UTC hitting `POST /api/cron/refresh-insights` to regenerate ML insight cards.

## Environment Variables

See `/app/.env.example`. Key groups: Supabase (proxy URL/key, DATABASE_URL), Firebase (client config + service account JSON), Gemini API key, Stripe keys, QR JWT secret.
