// All provider calls go through the Worker — no API keys in this bundle.
const WORKER_URL = 'https://negotiateai-worker.mphampson.workers.dev'

const TOKEN_KEY = 'negotiateai_token'

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${WORKER_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })
  if (res.status === 401) {
    clearToken()
    throw new Error('Unauthorized — wrong PIN')
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error || `Request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

export async function checkAuth(): Promise<boolean> {
  try {
    await call('/auth/check')
    return true
  } catch {
    return false
  }
}

export interface Negotiation {
  id: string
  title: string | null
  context: Record<string, string>
  started_at: string
  ended_at: string | null
}

export async function createSession(context: Record<string, string>): Promise<Negotiation> {
  const { data } = await call<{ data: Negotiation }>('/sessions', {
    method: 'POST',
    body: JSON.stringify({ context }),
  })
  return data
}

export async function endSession(id: string): Promise<void> {
  await call(`/sessions/${id}/end`, { method: 'PATCH' })
}

export interface Turn {
  negotiation_id: string
  kind: 'transcript' | 'coaching_card' | 'note'
  speaker?: 'me' | 'counterparty'
  content: string
  is_interim?: boolean
}

export async function saveTurns(turns: Turn[]): Promise<void> {
  if (!turns.length) return
  await call('/turns', { method: 'POST', body: JSON.stringify(turns) })
}

export async function getDeepgramToken(): Promise<string> {
  const { access_token } = await call<{ access_token: string }>('/dg-token', { method: 'POST' })
  return access_token
}

export async function getCoachingCard(
  context: Record<string, string>,
  transcript: string,
): Promise<string | null> {
  const { card } = await call<{ card: string | null }>('/coach', {
    method: 'POST',
    body: JSON.stringify({ context, transcript }),
  })
  return card
}
