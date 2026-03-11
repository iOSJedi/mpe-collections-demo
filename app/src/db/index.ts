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
