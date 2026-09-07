import {
  defineToolInputGuardrail,
  tool,
  ToolGuardrailFunctionOutputFactory,
} from '@openai/agents';
import axios from 'axios';

import { z } from 'zod';
import { Resend } from 'resend';

const notes: Array<{ title: string; body: string; createdAt: string }> = [];

const noteLengthGuardrail = defineToolInputGuardrail({
  name: 'note_length_limit',
  run: async ({ toolCall }) =>
    toolCall.arguments.length > 1_500
      ? ToolGuardrailFunctionOutputFactory.rejectContent('The note is too large.')
      : ToolGuardrailFunctionOutputFactory.allow(),
});

export const getCurrentTime_tool = tool({
  name: 'get_current_time',
  description: 'Gets the current ISO time for a requested timezone label.',
  parameters: z.object({ timezone: z.string().describe("timezone like UTC") }),
  execute: async ({ timezone }) => ({
    timezone,
    isoTime: new Date().toISOString(),
    note: 'Demo returns UTC',
  }),
});

export const listNotes_tool = tool({
  name: 'list_notes',
  description: 'Lists notes saved during this server process.',
  parameters: z.object({}),
  execute: async () => ({ notes }),
});

export const saveNote_tool = tool({
  name: 'save_note',
  description: 'Saves a short note. This demo action always requires human approval.',
  parameters: z.object({ title: z.string().describe("title of note"), body: z.string().describe("body of note") }),
  needsApproval: true,
  inputGuardrails: [noteLengthGuardrail],
  execute: async ({ title, body }) => {
    const note = { title, body, createdAt: new Date().toISOString() }
    notes.push(note)
    return { saved: true, note }
  },
});


export const getWeatherTool = tool({
  name: 'get_weather',
  description: 'Get current weather for a city. Use this first before sending email.',
  parameters: z.object({
    city: z.string().describe('City name, e.g. London'),
  }),
  needsApproval: false,
  execute: async function ({ city }) {
    const url = `https://wttr.in/${city.toLowerCase()}?format=%C+%t`
    const response = await axios.get(url, { responseType: 'text' })
    return `The weather in ${city} is ${response.data}`
  },
});

export const sendmail_tool = tool({
  name: 'send_mail_to_users',
  description: 'Send weather info to user by email AFTER you have called get_weather.',
  parameters: z.object({
    to: z.string().describe('Recipient email'),
    subject: z.string().describe('Email subject'),
    body: z.string().describe('HTML body of email'),
  }),
  needsApproval: true,
  execute: async function ({ body, subject, to }) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('Email service is not configured: set RESEND_API_KEY on the backend.')
    }
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { data, error } = await resend.emails.send({
      from: 'Acme <onboarding@resend.dev>',
      to: [to],
      subject,
      html: body,
    })
    if (error) throw new Error(error.message)
    return { sent: true, id: data?.id }
  },
});
