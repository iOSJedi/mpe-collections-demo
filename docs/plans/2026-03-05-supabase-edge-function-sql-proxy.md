# Supabase Edge Function SQL Proxy — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Route all database queries through a Supabase Edge Function to bypass Vercel's inability to resolve Supabase's IPv6-only direct database host.

**Architecture:** A Supabase Edge Function receives SQL+params over HTTPS (IPv4), executes them against the local Postgres instance, and returns rows. The app's Drizzle db layer switches from `postgres-js` driver to `pg-proxy` driver, which POSTs queries to the Edge Function. All 40+ existing queries across 8 files remain unchanged.

**Tech Stack:** Supabase Edge Functions (Deno), Drizzle ORM pg-proxy driver, Supabase CLI

---

### Task 1: Initialize Supabase project structure

**Files:**
- Create: `supabase/config.toml`

**Step 1: Initialize Supabase project**

```bash
cd /home/josef/projects/jc-trade-promotion-optimization
npx supabase init
```

This creates `supabase/config.toml` and `supabase/.gitignore`. If prompted, accept defaults.

**Step 2: Verify structure**

```bash
ls supabase/config.toml
```

Expected: file exists.

**Step 3: Commit**

```bash
git add supabase/
git commit -m "chore: initialize supabase project structure"
```

---

### Task 2: Create the SQL proxy Edge Function

**Files:**
- Create: `supabase/functions/sql-proxy/index.ts`

**Step 1: Create the Edge Function file**

```bash
mkdir -p supabase/functions/sql-proxy
```

**Step 2: Write the Edge Function**

Create `supabase/functions/sql-proxy/index.ts` with this content:

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

const DB_URL = Deno.env.get("SUPABASE_DB_URL")!;
const API_KEY = Deno.env.get("SQL_PROXY_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const sql = postgres(DB_URL, { prepare: false });

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-api-key, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  // Auth check
  const key = req.headers.get("x-api-key") || req.headers.get("authorization")?.replace("Bearer ", "");
  if (key !== API_KEY) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { sql: query, params, method } = await req.json();
    const result = await sql.unsafe(query, params || []);
    const rows = Array.from(result);
    return Response.json({ rows });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});
```

**Step 3: Commit**

```bash
git add supabase/functions/sql-proxy/
git commit -m "feat: add sql-proxy supabase edge function"
```

---

### Task 3: Deploy the Edge Function

**Step 1: Link Supabase project**

```bash
npx supabase link --project-ref tueynoicdgdtfwbyvycj
```

When prompted for database password, enter: `cHqbb8VWaZCgFbgh`

**Step 2: Set the SQL_PROXY_KEY secret**

Generate a random key and set it:

```bash
SQL_PROXY_KEY=$(openssl rand -hex 32)
echo "Generated key: $SQL_PROXY_KEY"
npx supabase secrets set SQL_PROXY_KEY="$SQL_PROXY_KEY"
```

Save the key — it will be needed for the Vercel env var in Task 5.

**Step 3: Deploy the function**

```bash
npx supabase functions deploy sql-proxy --no-verify-jwt
```

The `--no-verify-jwt` flag is needed because we handle auth ourselves via x-api-key.

**Step 4: Test the function**

Replace `YOUR_KEY` with the SQL_PROXY_KEY from Step 2:

```bash
curl -s -X POST "https://tueynoicdgdtfwbyvycj.supabase.co/functions/v1/sql-proxy" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_KEY" \
  -d '{"sql": "SELECT count(*) as n FROM branches", "params": [], "method": "all"}'
```

Expected: `{"rows":[{"n":7}]}`

---

### Task 4: Switch app DB layer to pg-proxy

**Files:**
- Modify: `app/src/db/index.ts`

**Step 1: Write the new db/index.ts**

Replace the entire contents of `app/src/db/index.ts` with:

```typescript
import { drizzle } from 'drizzle-orm/pg-proxy'
import * as schema from './schema'

const PROXY_URL = process.env.SUPABASE_SQL_PROXY_URL!
const PROXY_KEY = process.env.SUPABASE_SQL_PROXY_KEY!

export const db = drizzle(async (sql, params, method) => {
  const response = await fetch(PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': PROXY_KEY,
    },
    body: JSON.stringify({ sql, params, method }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`SQL proxy error (${response.status}): ${body}`)
  }

  const { rows } = await response.json()
  return { rows }
}, { schema })
```

**Step 2: Update local .env**

Add to `app/.env`:

```
SUPABASE_SQL_PROXY_URL=https://tueynoicdgdtfwbyvycj.supabase.co/functions/v1/sql-proxy
SUPABASE_SQL_PROXY_KEY=<the key from Task 3 Step 2>
```

**Step 3: Verify locally (will fail from WSL2 but tests the import)**

```bash
cd app && npx next build
```

Expected: Build succeeds (compile check only — runtime needs the proxy).

**Step 4: Commit**

```bash
git add app/src/db/index.ts
git commit -m "feat: switch db layer to pg-proxy via supabase edge function"
```

---

### Task 5: Set Vercel env vars and deploy

**Step 1: Set new env vars on Vercel**

Using the Vercel API (token: `vca_7DoqYPOfCYfWwVovDEKFSga5N7X7I30yBkIEGy4IrFwHsnL2XJ4Mz4Wp`, project: `prj_NVbuTxVWcxcitTHRPh1B8BezDSMf`):

```bash
curl -s -X POST "https://api.vercel.com/v10/projects/prj_NVbuTxVWcxcitTHRPh1B8BezDSMf/env" \
  -H "Authorization: Bearer vca_7DoqYPOfCYfWwVovDEKFSga5N7X7I30yBkIEGy4IrFwHsnL2XJ4Mz4Wp" \
  -H "Content-Type: application/json" \
  -d '[
    {"key":"SUPABASE_SQL_PROXY_URL","value":"https://tueynoicdgdtfwbyvycj.supabase.co/functions/v1/sql-proxy","type":"plain","target":["production","preview","development"]},
    {"key":"SUPABASE_SQL_PROXY_KEY","value":"<KEY_FROM_TASK_3>","type":"encrypted","target":["production","preview","development"]}
  ]'
```

The old `DATABASE_URL` env var can remain (unused by the app now, still used by seed script and Lambda).

**Step 2: Push and deploy**

```bash
git push origin master
```

Vercel auto-deploys on push. Monitor until READY.

**Step 3: Verify the health endpoint**

```bash
curl -s "https://jc-trade-promotion-optimization.vercel.app/api/health"
```

Expected: `{"dbConnection":"ok", ...}` with tables listed.

**Step 4: Verify the dashboard**

Open https://jc-trade-promotion-optimization.vercel.app and log in. The dashboard should load KPI data and insight cards.

---

### Task 6: Clean up health check endpoint

**Files:**
- Delete: `app/src/app/api/health/route.ts`

**Step 1: Remove the debug health check**

```bash
rm app/src/app/api/health/route.ts
rmdir app/src/app/api/health/
```

**Step 2: Commit and push**

```bash
git add -A
git commit -m "chore: remove debug health check endpoint"
git push origin master
```
