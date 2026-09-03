import {
  defineToolInputGuardrail,
  tool,
  ToolGuardrailFunctionOutputFactory,
} from '@openai/agents';
import { z } from 'zod';

const notes: Array<{ title: string; body: string; createdAt: string }> = [];

const noteLengthGuardrail = defineToolInputGuardrail({
  name: 'note_length_limit',
  run: async ({ toolCall }) =>
    toolCall.arguments.length > 1_500
      ? ToolGuardrailFunctionOutputFactory.rejectContent('The note is too large.')
      : ToolGuardrailFunctionOutputFactory.allow(),
});

const getCurrentTime = tool({
  name: 'get_current_time',
  description: 'Gets the current ISO time for a requested timezone label.',
  parameters: z.object({ timezone: z.string().default('UTC') }),
  execute: async ({ timezone }) => ({
    timezone,
    isoTime: new Date().toISOString(),
    note: 'Demo returns UTC. Replace with a timezone-aware service if required.',
  }),
});

const listNotes = tool({
  name: 'list_notes',
  description: 'Lists notes saved during this server process.',
  parameters: z.object({}),
  execute: async () => ({ notes }),
});

const saveNote = tool({
  name: 'save_note',
  description: 'Saves a short note. This demo action always requires human approval.',
  parameters: z.object({ title: z.string().min(1).max(80), body: z.string().min(1).max(1_000) }),
  needsApproval: true,
  inputGuardrails: [noteLengthGuardrail],
  execute: async ({ title, body }) => {
    const note = { title, body, createdAt: new Date().toISOString() };
    notes.push(note);
    // TODO: Replace the in-memory array with your database write.
    return { saved: true, note };
  },
});

export const demoTools = [getCurrentTime, listNotes, saveNote];
