import express from 'express';
import { askAgent } from './agent.ts';

const port = Number(process.env.PORT ?? 3000);

export function createApp() {
  const app = express();

  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_request, response) => {
    response.json({ status: 'ok' });
  });

  app.post('/api/chat', async (request, response) => {
    const { message } = request.body as { message?: unknown };

    if (typeof message !== 'string' || message.trim().length === 0) {
      response.status(400).json({ error: 'message must be a non-empty string' });
      return;
    }

    try {
      const result = await askAgent(message.trim());
      response.json(result);
    } catch (error) {
      console.error('Agent run failed:', error);
      response.status(500).json({ error: 'Unable to run the agent' });
    }
  });

  // TODO: Add project-specific routes here, such as webhooks, uploads, or auth.
  return app;
}

export function startServer() {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('OPENAI_API_KEY is not set. POST /api/chat will fail until you add it.');
  }

  const server = createApp().listen(port, () => {
    console.log(`Hackathon agent API listening on http://localhost:${port}`);
  });

  // Bun can otherwise let the event loop finish after module evaluation.
  server.ref();
  return server;
}
