import {
  Agent,
  MemorySession,
  Runner,
} from '@openai/agents';
import type { InputGuardrail, OutputGuardrail } from '@openai/agents';
import { z } from 'zod';
import { demoTools } from './tools/index.ts';


const sessions = new Map<string, MemorySession>();

/** DEMO ONLY: this disappears after a restart. Replace it with your DB Session. */
export function getSession(sessionId: string) {
  let session = sessions.get(sessionId);
  if (!session) {
    session = new MemorySession({ sessionId });
    sessions.set(sessionId, session);
  }
  return session;
}


const inputSafety: InputGuardrail = {
  name: 'block_prompt_injection_demo',
  runInParallel: false,
  execute: async ({ input }) => {
    const text = typeof input === 'string' ? input : JSON.stringify(input);
    return {
      tripwireTriggered: /ignore (all |the )?(previous|system) instructions|reveal .*api key/i.test(text),
      outputInfo: { rule: 'basic prompt-injection demonstration' },
    };
  },
};

const outputSafety: OutputGuardrail = {
  name: 'block_secret_like_output_demo',
  execute: async ({ agentOutput }) => ({
    tripwireTriggered: /sk-[a-zA-Z0-9_-]{12,}/.test(JSON.stringify(agentOutput)),
    outputInfo: { rule: 'basic secret-leak demonstration' },
  }),
};

export const demoAgent = new Agent({
  name: 'Agent SDK Showcase',
  instructions: `You are a helpful assistant inside an OpenAI Agents SDK feature showcase.
Use tools when useful. The save_note tool requires human approval. Never claim it
saved anything until the tool has completed. Return concise structured output.`,
  model: process.env.OPENAI_MODEL,
  tools: demoTools,
  inputGuardrails: [inputSafety],
  outputGuardrails: [outputSafety],
  outputType: ,
});

/** Reuse one Runner for shared tracing and execution configuration. */
export const runner = new Runner({
  workflowName: 'agent-sdk-showcase',
  traceMetadata: { app: 'agent-sdk-showcase' },
  toolExecution: { maxFunctionToolConcurrency: 3, preApprovalInputGuardrails: true },
});

export function displayOutput(output: unknown) {
  if (typeof output === 'string') return output;
  if (output && typeof output === 'object' && 'answer' in output) return String(output.answer);
  return JSON.stringify(output);
}
