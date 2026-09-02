import { Agent, run } from '@openai/agents';
import { hackathonTools } from './tools/index.ts';

/**
 * The main agent for the hackathon project.
 *
 * Change the name, instructions, model, and tools here once the product idea
 * is decided. Keep secrets in .env, never in this file.
 */
export const hackathonAgent = new Agent({
  name: 'Hackathon Assistant',
  instructions: `
You are the assistant for an AI hackathon project.

The product is still being designed. Be helpful, concise, and transparent about
what you can and cannot do. Use a tool when it is relevant and available.

TODO: Replace these instructions with the agent's real role, boundaries,
voice, tool-use rules, and success criteria.
  `.trim(),
  // Leave this unset to use the Agents SDK default model, or configure it in .env.
  model: process.env.OPENAI_MODEL,
  tools: hackathonTools,
});

export async function askAgent(message: string) {
  const result = await run(hackathonAgent, message);

  return {
    output: result.finalOutput ?? '',
    agent: result.lastAgent?.name ?? hackathonAgent.name,
  };
}
