import {
  Agent,
  MemorySession,
  Runner,
} from '@openai/agents';
import type { InputGuardrail, OutputGuardrail } from '@openai/agents';
import { getCurrentTime_tool, getWeatherTool, sendmail_tool } from './tools/index.ts';
import dotenv from "dotenv"


dotenv.config()


const sessions = new Map<string, MemorySession>();

export function displayOutput(output: unknown) {
  if (typeof output === 'string') return output;
  if (output && typeof output === 'object' && 'answer' in output) return String(output.answer);
  return JSON.stringify(output);
}
/** DEMO ONLY: this disappears after a restart. Replace it with your DB Session. */
export function getSession(sessionId: string) {
  let session = sessions.get(sessionId);
  if (!session) {
    session = new MemorySession({ sessionId });
    sessions.set(sessionId, session);
  }
  return session;
}


// simple raw js checks - no regex
const inputSafety: InputGuardrail = {
  name: 'block_prompt_injection_demo',
  runInParallel: false,
  execute: async ({ input }) => {
    const text = typeof input === 'string' ? input : JSON.stringify(input)
    const lower = text.toLowerCase()
    // simple check without regex
    const blocked = lower.includes("ignore previous instructions") || lower.includes("reveal api key")
    return {
      tripwireTriggered: blocked,
      outputInfo: { rule: 'basic check' },
    }
  },
}

const outputSafety: OutputGuardrail = {
  name: 'block_secret_like_output_demo',
  execute: async ({ agentOutput }) => {
    const text = JSON.stringify(agentOutput)
    // simple check - just look for sk- without regex
    const blocked = text.includes("sk-")
    return {
      tripwireTriggered: blocked,
      outputInfo: { rule: 'basic check' },
    }
  },
}

export const demoAgent = new Agent({
  name: 'weather agent',
  instructions: `You are a helpful weather agent.

WORKFLOW:
1. When user asks weather for a city, call get_weather first.
2. If user wants email (e.g. "send me weather", "mail me"), then AFTER you get weather, call send_mail_to_users.
   - to = user's email (ask if not provided)
   - subject = short, must include city + weather, e.g. "Weather in London: Cloudy 18°C"
   - body = HTML with <p> tags, include: greeting, city, condition, temperature, and friendly tip. Example: "<p>Hi! Weather in London is Cloudy 18°C.</p><p>Have a great day!</p>"
3. send_mail_to_users requires human approval - explain to user you are waiting for approval.
4. Never claim email sent until tool succeeds.

Use tools when useful. Be concise.`,
  tools: [getWeatherTool, sendmail_tool, getCurrentTime_tool],
  inputGuardrails: [inputSafety],
  outputGuardrails: [outputSafety],
});

/** Reuse one Runner for shared tracing and execution configuration. */
export const runner = new Runner({
  model: process.env.OPENAI_MODEL || "gpt-4o-mini",
  workflowName: 'weather-agent',
  traceMetadata: { app: 'weather-agent' },
  toolExecution: { maxFunctionToolConcurrency: 3, preApprovalInputGuardrails: true },
});
 
