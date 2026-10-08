import { afterEach, expect, test, vi } from 'vitest'
import app from './index'

const env = { APP_TOKEN: 't', ANTHROPIC_API_KEY: 'k', ALLOWED_ORIGINS: 'https://x.test' } as any
const post = (path: string, body: unknown) =>
  app.fetch(
    new Request(`https://w.test${path}`, {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env,
  )
const stub = (reply: unknown) => {
  const sent: any[] = []
  vi.stubGlobal('fetch', async (_u: unknown, init?: RequestInit) => {
    sent.push(JSON.parse(String(init?.body)))
    return new Response(JSON.stringify(reply), { status: 200 })
  })
  return sent
}
const text = (t: string) => ({ content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: t }] })

afterEach(() => vi.unstubAllGlobals())

test('/coach: 5.5 model, low effort, no banned params, skips thinking block', async () => {
  const sent = stub(text('Hold your number.'))
  const res = await post('/coach', { context: {}, transcript: 'take it or leave it' })
  expect(await res.json()).toEqual({ card: 'Hold your number.' })
  expect(sent[0].model).toBe('claude-haiku-5-5')
  expect(sent[0].output_config).toEqual({ effort: 'low' })
  expect(sent[0].max_tokens).toBeGreaterThanOrEqual(1024)
  for (const k of ['temperature', 'top_p', 'top_k', 'thinking']) expect(sent[0]).not.toHaveProperty(k)
  expect(sent[0].messages.at(-1).role).toBe('user')
})

test('/coach: PASS -> null card', async () => {
  stub(text('PASS'))
  expect(await (await post('/coach', { context: {}, transcript: 'hi' })).json()).toEqual({ card: null })
})

test('/coach: refusal -> existing 502 error path', async () => {
  stub({ stop_reason: 'refusal', content: [] })
  expect((await post('/coach', { context: {}, transcript: 'x' })).status).toBe(502)
})

test('/extract-text: 5.5 model, low effort, text block found after thinking; refusal -> 502', async () => {
  const sent = stub(text('doc text'))
  const res = await post('/extract-text', { pdf_base64: 'AAAA' })
  expect(await res.json()).toEqual({ text: 'doc text' })
  expect(sent[0].model).toBe('claude-haiku-5-5')
  expect(sent[0].output_config).toEqual({ effort: 'low' })
  stub({ stop_reason: 'refusal', content: [] })
  expect((await post('/extract-text', { pdf_base64: 'AAAA' })).status).toBe(502)
})
