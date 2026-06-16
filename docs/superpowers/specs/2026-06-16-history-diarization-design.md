# NegotiateAI — History + Diarization + Git CD (2026-06-16)

Design for a four-part build approved by Patrick. Functional-first; a visual design pass follows separately.

## 1. Session History

The app already persists every negotiation (`negotiations`) and every turn (`negotiation_turns`) to Neon, but the worker has **no read endpoints** and there is no UI to review past sessions. This closes that loop.

**Worker (`worker/src/index.ts`)** — two new GET endpoints (behind the existing bearer gate):
- `GET /sessions` → all negotiations, newest first (`order by started_at desc`). Returns `{ data: Negotiation[] }`.
- `GET /sessions/:id` → `{ data: { negotiation, turns } }`; turns ordered `by occurred_at asc`.

**Client (`src/lib/api.ts`)** — `listSessions()`, `getSession(id)`.

**UI (`src/History.tsx`)** — single component, internal list/detail state:
- List: one row per negotiation. Label derived from `context.counterpartyProfile` (first ~40 chars) or "Untitled negotiation"; subline = formatted `started_at` + "· in progress" when `ended_at` is null.
- Detail: that negotiation's turns interleaved in time order. `kind:'transcript'` rendered like the live feed (color-coded by speaker); `kind:'coaching_card'` rendered as a highlighted card.
- Reached via a **History** button in the `DealContext` header. `'history'` added to the `Screen` union in `App.tsx`; back returns to `deal-context`.

No search/delete (YAGNI).

## 2. Diarization — color-coded Speaker 1/2

Deepgram separates voices but only as anonymous integer indices (0,1,2…); it cannot know which is Patrick. This pass shows speakers distinctly without guessing identity; "Me vs Counterparty" naming is deferred to the design pass.

- `diarize: 'true'` added to the Deepgram WS params (`Session.tsx`).
- **`src/lib/diarize.ts`** — pure helpers (unit-tested):
  - `segmentBySpeaker(words)` groups Deepgram's per-word `speaker` indices into `{ speaker, text }` runs, preferring `punctuated_word`.
  - `speakerColor(n)`, `speakerLabel(n)` — shared palette + "S1/S2" labels used by both Session and History.
- On each final result: segment the `words` array; render one color-coded line per segment; save one turn per segment with `speaker = String(index)`; push `S{n}: text` to the coach tail so cards understand turn-taking. If a final has no `words` (short utterance / diarization gap), fall back to the flat transcript with no speaker color.
- Interim results stay gray/unattributed as today.
- `Turn.speaker` type widened from `'me'|'counterparty'` to `string` (DB column is already `text`).

## 3. Git CD

Wire GitHub→Netlify auto-deploy for the frontend (build `npm run build`, publish `dist`). Attempted via Netlify API; may require a one-time dashboard relink (per the Ledger experience). The CF Worker stays on `wrangler`.

## 4. CLAUDE.md cleanup

Remove the stale "DEEPGRAM_API_KEY not set / no Deepgram account" blocker (resolved 2026-06-10, smoke passed); update status and next-steps to current reality.

## Testing
- Unit tests on `segmentBySpeaker` (single/multi-speaker, empty, punctuation, missing-speaker default).
- Real-Neon round-trip on the GET endpoints (seed → fetch → assert), per the "mocked DB hides integration bugs" lesson.
- DOM-level verification of History via `preview_eval` against the deployed worker.
- Live-mic diarization is the one path only confirmable on a real speakerphone call (flagged, same as the original transcription smoke).

## Schema (verified live, project `winter-silence-68980700`)
- `negotiations(id uuid, title text, context jsonb, started_at tstz, ended_at tstz, created_at tstz, updated_at tstz)`
- `negotiation_turns(id uuid, negotiation_id uuid, kind text, speaker text, content text, is_interim bool, occurred_at tstz)`
