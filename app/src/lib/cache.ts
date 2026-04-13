import { NextResponse } from 'next/server'

/**
 * Wrap a NextResponse.json() with Vercel edge cache headers.
 *
 * s-maxage: how long Vercel's CDN caches the response (seconds)
 * stale-while-revalidate: serve stale cache while fetching fresh data in background
 *
 * Since our API routes require auth (Bearer token), Vercel won't cache by default.
 * We use a private cache with short TTL for authenticated responses.
 */
export function cachedJson(data: unknown, ttl = 30, staleWhileRevalidate = 60, status = 200): NextResponse {
  const res = NextResponse.json(data, { status })
  res.headers.set('Cache-Control', `private, s-maxage=${ttl}, stale-while-revalidate=${staleWhileRevalidate}`)
  return res
}

/**
 * Simple in-memory server-side cache for expensive queries.
 * Lives for the lifetime of the serverless function instance.
 * On Vercel, this persists across requests to the same warm instance.
 */
const memCache = new Map<string, { data: unknown; expires: number }>()

export function getFromCache<T>(key: string): T | null {
  const entry = memCache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expires) {
    memCache.delete(key)
    return null
  }
  return entry.data as T
}

export function setInCache(key: string, data: unknown, ttlMs = 30_000): void {
  memCache.set(key, { data, expires: Date.now() + ttlMs })
  // Prevent unbounded growth
  if (memCache.size > 200) {
    const oldest = memCache.keys().next().value
    if (oldest) memCache.delete(oldest)
  }
}
