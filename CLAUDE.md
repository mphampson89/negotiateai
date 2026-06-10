# negotiateai
## Claude Code Session Context
## Last Updated: 2026-06-10

## Purpose
Real-time AI negotiation coach PWA. Live at negotiateai-mph.netlify.app.

## Stack
React + Vite + TS frontend (Netlify, CLI deploy — no git CD). Cloudflare Worker
`negotiateai-worker.mphampson.workers.dev` (worker/) → Neon `winter-silence-68980700`.
Deepgram nova-2 streaming transcription, Claude Haiku coaching cards.

## Current Status
T05 shipped 2026-06-10 (ADR-036): PIN gate (288989), Worker proxy for all keys,
live transcription via AudioWorklet→Deepgram WS, coaching cards on speech_final,
sessions + turns persisted to Neon.

## Known Issues or Blockers
- DEEPGRAM_API_KEY not set on the worker (no Deepgram account yet) — /dg-token
  returns 503, so transcription is inert until `wrangler secret put DEEPGRAM_API_KEY`.

## Next Steps
1. Patrick: create Deepgram account (free $200 credit), set the secret.
2. Android Chrome smoke: PIN → Start Session → Start Capturing near a speaker.
3. Possible next tickets: session history screen (read from Neon), speaker labeling.

## Architecture Notes
- ADR-036 (vault): Neon + CF Worker, dropped the cromwell-core Supabase plan.
- Browser connects DIRECTLY to Deepgram's WS using a 30s token minted by /dg-token;
  audio does not flow through the worker.
- Worker secrets are CLI-set (`wrangler secret put`) — safe across deploys.

## Do Not Touch
[List protected files/patterns here]
