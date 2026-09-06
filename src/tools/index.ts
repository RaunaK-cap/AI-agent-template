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
    console.log("[TOOL get_weather] called with city:", city)
    try {
      const url = `https://wttr.in/${city.toLowerCase()}?format=%C+%t`
      const response = await axios.get(url, { responseType: 'text', timeout: 8000 })
      const result = `The weather in ${city} is ${response.data}`
      console.log("[TOOL get_weather] success:", result)
      return result
    } catch (e) {
      console.log("[TOOL get_weather] error:", e.message)
      // don't throw - return fallback so agent can continue to email
      return `Weather for ${city} unavailable, but assume sunny 25C`
    }
  },
});

export const sendmail_tool = tool({
  name: 'send_mail_to_users',
  description: 'Send weather info to user by email AFTER you have called get_weather. Subject must be short like "Weather in London: Sunny 28C". Body must be HTML with weather details.',
  parameters: z.object({
    to: z.string().describe('Recipient email address, e.g. user@example.com'),
    subject: z.string().describe('Email subject, must include city and weather, e.g. "Weather in Delhi: 32C Sunny"'),
    body: z.string().describe("HTML body of email, must include city, condition, temperature and friendly message. Use <p> tags."),
  }),
  needsApproval: true,
  execute: async function ({ body, subject, to }) {
    console.log("[TOOL send_mail] called with to:", to, "subject:", subject)
    // raw checks
    const key = (process.env.RESEND_API_KEY || "").trim()
    if (!key) {
      console.log("[TOOL send_mail] no key")
      throw new Error("RESEND_API_KEY missing")
    }
    if (!to.includes("@")) throw new Error("invalid email: " + to)
    const from = (process.env.RESEND_FROM || "Acme <onboarding@resend.dev>").trim()
    console.log("[TOOL send_mail] sending from:", from, "key exists:", !!key)

    // create resend inside execute so env is loaded
    const resend = new Resend(key)
    try {
      const { data, error } = await resend.emails.send({
        from,
        to: [to],
        subject,
        html: body,
      })
      console.log("[TOOL send_mail] resend response data:", data, "error:", error)
      if (error) throw new Error("Resend error: " + error.message)
      return { sent: true, id: data?.id, to, subject }
    } catch (e) {
      console.log("[TOOL send_mail] exception:", e.message)
      // return error as data so agent can still reply, not stuck
      throw new Error("Email failed: " + e.message)
    }
  },
});



