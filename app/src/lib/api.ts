import { getIdToken } from '@/lib/firebase'

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = await getIdToken()
  const headers = new Headers(init?.headers)

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  return fetch(input, { ...init, headers })
}
