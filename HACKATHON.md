# HACKATHON.md — Syndicate by Maximor (Track 2) build guide + template reuse

> This file is the template's operating manual. Clone this repo for a new
> project, read this file top-to-bottom, work the checklist, ship.
> Backend lives in `src/` + `index.ts` (Bun + Express + OpenAI Agents SDK).
> Dashboard lives in `agent-dashboard/` (Next.js + shadcn, black/white minimal).
> Backend and dashboard talk over HTTP only — never import one from the other.

---

## 1. Architecture (how things connect)

```text
Maximor website  = BLUEPRINT (copy Learns -> Runs -> Escalates -> Improves)
AO desktop app   = MANAGER (writes code in this repo, you merge)
This repo        = PRODUCT
  Express backend  :8000  --SSE/JSON-->  Next.js dashboard :3000
  Neatlogs SDK     = FLIGHT RECORDER (traces of every runner.run)
```

| Piece | What judges see | Where |
|---|---|---|
| Dashboard `agent-dashboard/` | invoices, approval card, audit trail, live logs, chat | demo video 90s |
| AO board | coding sessions, branches, PRs | demo video 10s (mandatory: they count AO sessions) |
| Neatlogs dashboard | trace #4821, cost/latency before→after | deck 1 screenshot |

---

## 2. Endpoint contract (backend ↔ dashboard — do not drift)

Backend base URL: `http://localhost:8000` (see §3 ports).
Dashboard reads it from `agent-dashboard/.env.local` → `NEXT_PUBLIC_API_URL`.

| # | Method + path | Req body | Res |
|---|---|---|---|
| 1 | `GET /health` | — | `{status:'ok'}` (`src/server.ts`) |
| 2 | `POST /api/chat` | `{message: string, sessionId: string}` | `200 {status:'completed', output, rawOutput, agent, usage}` or `202 {status:'awaiting_approval', approvalId, approvals[]}` |
| 3 | `POST /api/approvals/:approvalId` | `{decision:'approve'\|'reject'}` | `{status, output, rawOutput}` |
| 4 | `POST /api/chat/stream` (SSE) | `{message, sessionId}` | events: `text-delta` (token), `agent-event` (`tool_called`/`tool_output`/agent switch), `completed {output, rawOutput, interruptions, usage, approvalId?}`, `error` |

Dashboard seams (only 3 spots need `fetch`, all marked in code):
- `agent-dashboard/src/app/page.tsx` → `decide()` → endpoint 3
- `agent-dashboard/components/dashboard/chat-panel.tsx` → `send()` → endpoint 2 (+ files later)
- `agent-dashboard/lib/use-live-logs.ts` → replace simulator with `fetch` + `EventSource` → endpoint 4

Streaming rule (OpenAI Agents SDK docs): `runner.run(agent, input, {stream:true})`
is `AsyncIterable` of 3 event types — forward the payload, not just `type`:
- `raw_model_stream_event` → `event.data.delta` → SSE `text-delta`
- `run_item_stream_event` → `event.name` (`tool_called`/`tool_output`/…) → SSE `agent-event`
- `agent_updated_stream_event` → `event.agent.name` → SSE `agent-event`
- then `await stream.completed` → SSE `completed` (+ store `stream.state` in
  `pendingRuns` so streamed runs can also return `approvalId`).

---

## 3. Setup (fresh clone → running, ~15 min)

```bash
# backend
cp .env.example .env            # fill OPENAI_API_KEY, set OPENAI_MODEL (never "")
bun install && bun run dev      # backend on :8000 (set PORT=8000 in .env)

# dashboard (new terminal)
cd agent-dashboard
cp .env.example .env.local 2>/dev/null || echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
bun install && bun run dev      # dashboard on :3000

# observability + manager
npx @neatlogs/wizard            # paste NEATLOGS_API_KEY into backend .env
# AO: install .deb/.AppImage from aoagents.dev/docs/installation,
# gh auth login, Add project -> this repo, create workers per §5
```

Ports: backend `PORT=8000`, dashboard `:3000`. Both default to 3000 — change
backend first or they collide. CORS: backend must allow `http://localhost:3000`.

---

## 4. Hackathon checklist (Track 2: Invoice Reconciliation Autopilot)

Scope: ONE workflow — CSV upload → auto-match → ≤$50 auto-close →
>$50 approval card → JE post → audit log download. Nothing bigger, solo 30h.

- [ ] **P0 — entrypoint:** `index.ts` must call `startServer()` from `src/server.ts`
  (thin file: dotenv + start + SIGTERM/SIGINT only). Verify `/health`.
- [ ] **P0 — env:** `.env` has real `OPENAI_API_KEY`; `OPENAI_MODEL` set or line
  deleted (empty string breaks the SDK); `PORT=8000`.
- [ ] **P0 — agent:** `src/agent.ts` `cfoAgent` with zod `outputType`
  `{answer, journalEntry, riskFlags, nextAction}`; Runner reused with tracing.
- [ ] **P0 — tools:** `src/tools/` = `parse_statement`, `match_invoices`,
  `post_journal (needsApproval:true)`, `get_cash_forecast`. Math in tools, never prompts.
- [ ] **P0 — approvals:** `202 awaiting_approval` → dashboard card → approve/reject
  resumes `RunState`. Demo data: 20 invoices, 18 match, -$38 auto, -$495 escalate.
- [ ] **P0 — audit log:** append-only `{who, what, amount, policyVersion, ts, approvalId}`
  + CSV download endpoint for judges.
- [ ] **P1 — stream enrichment:** `for await` forwards deltas + tool events (§2);
  `req.on('close')` stops writes; stream state saved to `pendingRuns`.
- [ ] **P1 — Neatlogs:** wizard done, 1 trace screenshot (cost/latency before→after) for deck.
- [ ] **P1 — Dodo:** sandbox key + "Pay vendor" button (fast-track in Discord same-day).
- [ ] **P1 — AO proof:** all work inside AO workers; 10s board recording for video.
- [ ] **P2 — evals:** same CSV twice → identical result, no double-post; kill API key
  → safe 500, no leak; metrics bar (auto-match %, $ recovered, time saved).
- [ ] **P2 — video (2:30):** 0:00 problem → 0:30 upload → 1:15 approve click →
  1:50 audit download → 2:10 AO sessions + "policy saved" improvement.
- [ ] **Submit:** Discord submission + pass post on X/LinkedIn tagging AO +
  writeup mentions AO usage + Neatlogs trace link.

---

## 5. Suggested AO workers (paste as tasks)

1. `tools-worker`: "In src/tools/index.ts add match_invoices + post_journal
   (needsApproval). Do NOT touch server.ts."
2. `ui-worker`: "In agent-dashboard/components/dashboard wire decide()/send()
   to NEXT_PUBLIC_API_URL per HACKATHON.md §2. Do NOT touch src/."
3. You: review + merge + record video.

---

## 6. Template reuse (future projects)

1. Clone repo, delete `src/tools/*` + `lib/mock-data.ts` contents, keep shapes.
2. Keep files that never change: `components/theme.tsx`, `lib/agent-types.ts`,
   `lib/use-live-logs.ts`, `Banners`, `LiveLogStream`, `ChatPanel` shell.
3. Per project change only: agent name + zod schema (`src/agent.ts`), tool list,
   `policy.json` thresholds, metric labels, mock data.
4. Re-verify: `bunx tsc --noEmit` + `bun run build` in `agent-dashboard/`;
   `bunx tsc --noEmit` at root. Lint note: `hooks/use-mobile.ts` error is
   shadcn-generated (sidebar, unused) — ignore or delete sidebar.

## 7. Links

- AO install: https://aoagents.dev/docs/installation/ · pass: https://aoagents.dev/hackathons/syndicate/pass/
- Neatlogs docs: https://docs.neatlogs.com · wizard: `npx @neatlogs/wizard`
- Agents SDK streaming: https://openai.github.io/openai-agents-js/guides/streaming
- Event: https://luma.com/d0kq45ek · Discord: https://discord.gg/Sy3EwRBQX3
