// NegotiateAI worker — holds all provider keys server-side.
// Browser never sees the Deepgram or Anthropic key:
//   /dg-token  mints a short-lived (30s) Deepgram access token for the WS connect
//   /coach     proxies Claude Haiku coaching-card calls
//   /sessions, /turns  persist to Neon (negotiations / negotiation_turns)
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { neon } from '@neondatabase/serverless'

type Bindings = {
  DATABASE_URL: string
  APP_TOKEN: string
  ANTHROPIC_API_KEY: string
  DEEPGRAM_API_KEY: string
  ANTHROPIC_MODEL?: string
  ALLOWED_ORIGINS: string
}

const db = (c: { env: Bindings }) => neon(c.env.DATABASE_URL)
const app = new Hono<{ Bindings: Bindings }>()

// ── CORS (pinned prod origin + localhost any port) ───────────────────────────
app.use('*', (c, next) => {
  const allowed = (c.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean)
  return cors({
    origin: (origin) => {
      if (!origin) return allowed[0] ?? ''
      if (allowed.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin)) return origin
      return allowed[0] ?? ''
    },
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
  })(c, next)
})

app.get('/health', (c) => c.json({ ok: true }))

// ── Bearer-token gate (single user) ──────────────────────────────────────────
app.use('*', async (c, next) => {
  const token = (c.req.header('Authorization') || '').replace(/^Bearer\s+/i, '')
  if (!c.env.APP_TOKEN || token !== c.env.APP_TOKEN) return c.json({ error: 'Unauthorized' }, 401)
  await next()
})

app.get('/auth/check', (c) => c.json({ ok: true }))

// ── Deepgram: mint a short-lived browser token ───────────────────────────────
app.post('/dg-token', async (c) => {
  if (!c.env.DEEPGRAM_API_KEY) return c.json({ error: 'DEEPGRAM_API_KEY not configured' }, 503)
  const res = await fetch('https://api.deepgram.com/v1/auth/grant', {
    method: 'POST',
    headers: { Authorization: `Token ${c.env.DEEPGRAM_API_KEY}` },
  })
  if (!res.ok) {
    console.error('deepgram grant failed', res.status, await res.text())
    return c.json({ error: `Deepgram token grant failed (${res.status})` }, 502)
  }
  // { access_token, expires_in } — expires_in is ~30s; client connects immediately
  return c.json(await res.json())
})

// ── Coaching card (Claude Haiku) ─────────────────────────────────────────────
const COACH_SYSTEM = `You are a real-time negotiation coach. You receive the user's deal context and the live transcript of an ongoing negotiation. Respond with ONE short, punchy coaching card (max 2 sentences) ONLY when the latest exchange warrants it: a trigger pattern fired, a hard line is threatened, a tactic needs countering, or a clear opportunity appeared. Speak directly to the user ("Hold your number — that deadline is artificial."). If nothing actionable is happening, respond with exactly: PASS`

const COACH_FORCED_SYSTEM = `You are a real-time negotiation coach. You receive the user's deal context and the live transcript of an ongoing negotiation. The user just tapped "Coach me" and wants guidance RIGHT NOW. Respond with ONE short, punchy coaching card (max 2 sentences) speaking directly to the user. If the transcript is thin or nothing tactical is happening, give your best strategic read against their deal context: leverage, recommended next move, or what to listen for. Always produce a card. Output only the card text itself — no headers, labels, or markdown formatting.`

app.post('/coach', async (c) => {
  const { context, transcript, force } = (await c.req.json()) as {
    context: Record<string, string>
    transcript: string
    force?: boolean
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': c.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: c.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      system: force ? COACH_FORCED_SYSTEM : COACH_SYSTEM,
      messages: [
        {
          role: 'user',
          content: `DEAL CONTEXT:\n${JSON.stringify(context, null, 2)}\n\nLIVE TRANSCRIPT (most recent last):\n${transcript || '(no speech captured yet)'}`,
        },
      ],
    }),
  })
  if (!res.ok) {
    console.error('anthropic failed', res.status, await res.text())
    return c.json({ error: `Coach call failed (${res.status})` }, 502)
  }
  const data = (await res.json()) as { content: { type: string; text?: string }[] }
  const text = (data.content?.[0]?.text || '').trim()
  return c.json({ card: !text || text === 'PASS' ? null : text })
})

// ── PDF text extraction (Claude document block — handles scanned PDFs too) ──
app.post('/extract-text', async (c) => {
  const { pdf_base64 } = (await c.req.json()) as { pdf_base64: string }
  if (!pdf_base64) return c.json({ error: 'pdf_base64 required' }, 400)
  // Anthropic caps PDF requests ~32MB; base64 inflates 4/3, so cap input ~8MB raw
  if (pdf_base64.length > 12_000_000) return c.json({ error: 'PDF too large (8MB max)' }, 400)
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': c.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: c.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdf_base64 } },
            { type: 'text', text: 'Extract the full text of this document verbatim. Output only the document text, no commentary.' },
          ],
        },
      ],
    }),
  })
  if (!res.ok) {
    console.error('extract-text failed', res.status, await res.text())
    return c.json({ error: `Extraction failed (${res.status})` }, 502)
  }
  const data = (await res.json()) as { content: { type: string; text?: string }[] }
  return c.json({ text: (data.content?.[0]?.text || '').trim() })
})

// ── Sessions ─────────────────────────────────────────────────────────────────
app.post('/sessions', async (c) => {
  const { title, context } = (await c.req.json()) as {
    title?: string
    context: Record<string, string>
  }
  const rows = await db(c)(
    'insert into negotiations (title, context) values ($1, $2) returning *',
    [title ?? null, JSON.stringify(context ?? {})],
  )
  return c.json({ data: rows[0] })
})

app.patch('/sessions/:id/end', async (c) => {
  const rows = await db(c)(
    'update negotiations set ended_at = now() where id = $1 returning *',
    [c.req.param('id')],
  )
  if (!rows.length) return c.json({ error: 'Not found' }, 404)
  return c.json({ data: rows[0] })
})

// ── Turns (single or batch) ──────────────────────────────────────────────────
const TURN_KINDS = new Set(['transcript', 'coaching_card', 'note'])

app.post('/turns', async (c) => {
  const body = await c.req.json()
  const turns: {
    negotiation_id: string
    kind: string
    speaker?: string
    content: string
    is_interim?: boolean
  }[] = Array.isArray(body) ? body : [body]
  if (!turns.length) return c.json({ data: [] })
  for (const t of turns) {
    if (!t.negotiation_id || !t.content || !TURN_KINDS.has(t.kind)) {
      return c.json({ error: 'turn needs negotiation_id, content, and a valid kind' }, 400)
    }
  }
  const vals: unknown[] = []
  const tuples = turns.map((t) => {
    vals.push(t.negotiation_id, t.kind, t.speaker ?? null, t.content, t.is_interim ?? false)
    const n = vals.length
    return `($${n - 4}, $${n - 3}, $${n - 2}, $${n - 1}, $${n})`
  })
  const rows = await db(c)(
    `insert into negotiation_turns (negotiation_id, kind, speaker, content, is_interim) values ${tuples.join(', ')} returning id`,
    vals,
  )
  return c.json({ data: rows })
})

export default app
