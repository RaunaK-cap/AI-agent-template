import type { Tool } from '@openai/agents';

/**
 * Add your agent's capabilities here.
 *
 * Example:
 *
 * import { tool } from '@openai/agents';
 * import { z } from 'zod';
 *
 * const lookupProjectInfo = tool({
 *   name: 'lookup_project_info',
 *   description: 'Looks up information from the hackathon project database.',
 *   parameters: z.object({ query: z.string().describe('What to look up') }),
 *   execute: async ({ query }) => {
 *     // TODO: Call your database or external service.
 *     return `No project data is connected yet for: ${query}`;
 *   },
 * });
 *
 * export const hackathonTools = [lookupProjectInfo];
 */
export const hackathonTools: Tool[] = [];
