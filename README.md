# OpenAI Agents SDK Showcase

A Bun + Express project that demonstrates the core Agents SDK building blocks without a database or any external business integration.

## Included

- Typed agent with structured output
- Three sample function tools
- Input, output, and tool guardrails
- Human approval before a state-changing tool
- In-memory `MemorySession` chat memory
- Reusable `Runner` with tracing metadata
- REST chat endpoint, approval endpoint, and full SDK streaming endpoint
- A tiny working browser demo at `/`
- A separate ChatKit entry point at `/chatkit.html`

## Start

```bash
cp .env.example .env
# Add OPENAI_API_KEY to .env
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

Try these prompts:

```text
What time is it in Asia/Kolkata?
Save a note titled SDK idea with body Add a database later.
List my notes.
```

The second prompt pauses at an approval card. Approve it, then ask the agent to list notes. Notes and conversation memory are in-process only and disappear on restart.

## Important files

- `src/agent.ts` — agent, structured output, guardrails, sessions, Runner/tracing.
- `src/tools/index.ts` — safe sample tools and a tool guardrail.
- `src/server.ts` — REST API, in-memory approval state, and streaming endpoint.
- `public/index.html` — working showcase UI.
- `public/chatkit.html` — ChatKit frontend insertion point.

## Database hooks

Search for `TODO:`. The main future replacement points are `getSession()` in `src/agent.ts`, the notes array in `src/tools/index.ts`, and the pending approval map in `src/server.ts`.

## ChatKit note

ChatKit supplies a frontend chat component but its self-hosted runtime uses a separate backend protocol. The included `chatkit.html` deliberately does not point at this Express app. Configure it only after you add a compatible ChatKit server or an OpenAI-hosted Agent Builder workflow. Until then, the fully functional SDK demo is at `/`.
