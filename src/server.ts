import { randomUUID } from 'node:crypto';
import type { RunState, RunToolApprovalItem } from '@openai/agents';
import express from 'express';
import { demoAgent, displayOutput, getSession, runner, type DemoContext } from './agent.ts';

const port = Number(process.env.PORT ?? 3000);
type PendingRun = { state: RunState<DemoContext, typeof demoAgent>; sessionId: string };
const pendingRuns = new Map<string, PendingRun>();

function sessionIdFrom(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : 'demo-session';
}

function approvalPayload(interruption: RunToolApprovalItem) {
  return {
    toolName: interruption.name ?? 'unknown_tool',
    arguments: interruption.arguments ?? '{}',
    agent: interruption.agent.name,
  };
}

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(express.static('public'));

  app.get('/health', (_request, response) => response.json({ status: 'ok' }));

  app.post('/api/chat', async (request, response) => {
    const { message, sessionId: rawSessionId } = request.body as { message?: unknown; sessionId?: unknown };
    if (typeof message !== 'string' || !message.trim()) {
      response.status(400).json({ error: 'message must be a non-empty string' });
      return;
    }
    const sessionId = sessionIdFrom(rawSessionId);
    const context: DemoContext = { userId: 'demo-user', sessionId };
    try {
      const result = await runner.run(demoAgent, message.trim(), { context, session: getSession(sessionId) });
      if (result.interruptions?.length) {
        const approvalId = randomUUID();
        pendingRuns.set(approvalId, { state: result.state, sessionId });
        response.status(202).json({
          status: 'awaiting_approval', approvalId, approvals: result.interruptions.map(approvalPayload),
        });
        return;
      }
      response.json({
        status: 'completed', output: displayOutput(result.finalOutput), rawOutput: result.finalOutput,
        agent: result.lastAgent?.name ?? demoAgent.name, usage: result.state.usage,
      });
    } catch (error) {
      console.error('Agent run failed:', error);
      response.status(500).json({ error: 'Unable to run the agent' });
    }
  });

  app.post('/api/approvals/:approvalId', async (request, response) => {
    const pending = pendingRuns.get(request.params.approvalId);
    const { decision } = request.body as { decision?: unknown };
    if (!pending || (decision !== 'approve' && decision !== 'reject')) {
      response.status(400).json({ error: 'Unknown approval or invalid decision' });
      return;
    }
    for (const interruption of pending.state.getInterruptions()) {
      if (decision === 'approve') pending.state.approve(interruption);
      else pending.state.reject(interruption, { message: 'The user rejected this action.' });
    }
    pendingRuns.delete(request.params.approvalId);
    try {
      const result = await runner.run(demoAgent, pending.state, {
        context: { userId: 'demo-user', sessionId: pending.sessionId }, session: getSession(pending.sessionId),
      });
      response.json({
        status: result.interruptions?.length ? 'awaiting_approval' : 'completed',
        output: displayOutput(result.finalOutput), rawOutput: result.finalOutput,
      });
    } catch (error) {
      console.error('Approval continuation failed:', error);
      response.status(500).json({ error: 'Unable to continue the agent run' });
    }
  });

  /** Full SDK event stream for custom UIs; see ChatKit note in README. */
  app.post('/api/chat/stream', async (request, response) => {
    const { message, sessionId: rawSessionId } = request.body as { message?: unknown; sessionId?: unknown };
    if (typeof message !== 'string' || !message.trim()) {
      response.status(400).json({ error: 'message must be a non-empty string' });
      return;
    }
    const sessionId = sessionIdFrom(rawSessionId);
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');
    response.flushHeaders();
    try {
      const stream = await runner.run(demoAgent, message.trim(), {
        stream: true, context: { userId: 'demo-user', sessionId }, session: getSession(sessionId),
      });
      for await (const event of stream) {
        response.write(`event: agent-event\ndata: ${JSON.stringify({ type: event.type })}\n\n`);
      }
      await stream.completed;
      response.write(`event: completed\ndata: ${JSON.stringify({
        output: displayOutput(stream.finalOutput), rawOutput: stream.finalOutput,
        interruptions: stream.interruptions?.map(approvalPayload) ?? [],
      })}\n\n`);
    } catch (error) {
      response.write(`event: error\ndata: ${JSON.stringify({ error: String(error) })}\n\n`);
    } finally {
      response.end();
    }
  });

  // TODO: Add auth plus database-backed sessions and approval persistence here.
  return app;
}

export function startServer() {
  if (!process.env.OPENAI_API_KEY) console.warn('OPENAI_API_KEY is not set. Agent endpoints will fail until you add it.');
  const server = createApp().listen(port, () => console.log(`Agent SDK showcase running at http://localhost:${port}`));
  server.ref();
  return server;
}
