# negotiateai
## Claude Code Session Context
## Last Updated: 2026-06-16

## Purpose
Real-time AI negotiation coach PWA. Live at negotiateai-mph.netlify.app.

## Stack
React + Vite + TS frontend (Netlify, **Git CD on `main`** — push auto-deploys; site
`c6810d59-8e11-420d-8b2d-25bd56210c0c`). Cloudflare Worker
`negotiateai-worker.mphampson.workers.dev` (worker/) → Neon `winter-silence-68980700`.
Deepgram nova-2 streaming transcription, Claude Haiku coaching cards.

## Current Status
T05 shipped 2026-06-10 (ADR-036): PIN gate (288989), Worker proxy for all keys,
live transcription via AudioWorklet→Deepgram WS, coaching cards on speech_final,
sessions + turns persisted to Neon. Deepgram key live since 2026-06-10; phone smoke passed.
2026-06-16: **Session History** screen (worker `GET /sessions` + `/sessions/:id`, reads Neon)
and **color-coded Speaker 1/2 diarization** (`diarize=true`; `src/lib/diarize.ts`, unit-tested) shipped.

## Known Issues or Blockers
- None blocking. Diarization shows anonymous Speaker 1/2 only — it does not yet resolve
  which voice is Patrick ("Me" vs "Counterparty"); deferred to the visual design pass.
- Real-call use needs a speakerphone (the mic only hears the room).

## Next Steps
1. Patrick phone-smoke: open **History** → tap a past session → confirm transcript + cards render;
   on a real speakerphone call, confirm Speaker 1/2 separate by colour.
2. Visual design pass (History list/detail polish; "Me vs Counterparty" speaker naming).

## Architecture Notes
- ADR-036 (vault): Neon + CF Worker, dropped the cromwell-core Supabase plan.
- Browser connects DIRECTLY to Deepgram's WS using a 30s token minted by /dg-token;
  audio does not flow through the worker.
- Worker secrets are CLI-set (`wrangler secret put`) — safe across deploys.
- History reads past sessions via worker `GET /sessions` and `/sessions/:id` (Neon);
  all read endpoints live in the worker (browser never touches Neon directly).
- Diarization: Deepgram tags words with integer speaker indices; the client segments them
  (`src/lib/diarize.ts` `segmentBySpeaker`) and colours Speaker 1/2 — it does NOT infer
  identity. Turns persist the speaker index as text.

## Do Not Touch
[List protected files/patterns here]
