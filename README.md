# AI Hackathon Agent Starter

A minimal Bun + Express API using the [OpenAI Agents SDK](https://openai.github.io/openai-agents-js/). It starts with one agent and leaves intentional extension points for tools, prompts, routes, memory, and multi-agent orchestration.

## Run it

1. Copy the environment template and add your API key:

   ```bash
   cp .env.example .env
   ```

2. Put a real `OPENAI_API_KEY` in `.env`.

3. Start the API:

   ```bash
   bun run dev
   ```

The API is available at `http://localhost:3000`.

## Try it

```bash
curl http://localhost:3000/health

curl -X POST http://localhost:3000/api/chat \\
  -H 'Content-Type: application/json' \\
  -d '{"message":"Help me brainstorm an AI hackathon idea."}'
```

## Where to customize

- `src/agent.ts` — the agent's name, instructions, model, and future handoffs.
- `src/tools/index.ts` — add function tools with Zod schemas.
- `src/server.ts` — add routes, authentication, webhooks, and file handling.

## Notes

`POST /api/chat` is intentionally stateless for now. Once we decide the product, we can add conversation memory, streaming responses, guardrails, authentication, a database, or specialist agents.
