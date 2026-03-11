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
    // Drizzle's mapResultRow expects rows as positional value arrays, not key-value objects.
    // postgres.js returns row objects; convert each row to an ordered array of values.
    // Object.values() preserves insertion order, which matches the SQL column order.
    const rows = Array.from(result).map((row) => Object.values(row as Record<string, unknown>));
    return Response.json({ rows });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});
