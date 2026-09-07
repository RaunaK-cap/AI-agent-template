// @ts-nocheck - simple
import express from "express"
import dotenv from "dotenv"
import { demoAgent, displayOutput, getSession, runner } from "./src/agent.ts"
import { randomUUID } from "node:crypto"

dotenv.config()
const app = express()
const PORT = process.env.PORT || 8000
app.use(express.json())
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
  res.header("Access-Control-Allow-Headers", "Content-Type")
  if (req.method === "OPTIONS") return res.sendStatus(204)
  next()
})

const waiting = new Map() // waitId -> {state, chatId}
const history = new Map() // chatId -> {logs:[], traces:[]}

function getBox(chatId) {
  if (!history.has(chatId)) history.set(chatId, { logs: [], traces: [] })
  return history.get(chatId)
}

app.get("/health", (req, res) => {
  console.log("[health] hit")
  res.json({ message: "api is working" })
})

function approvalPayload(waitId, item) {
  return {
    status: "awaiting_approval",
    approval: {
      id: waitId,
      toolName: item.name,
      arguments: item.arguments,
    },
  }
}

// A completed HTTP request represents one completed agent state: either an
// answer or a paused tool approval. Never keep a browser request open while
// waiting for a person to decide; browsers, proxies, and React state can all
// otherwise leave the chat in a permanent loading state.
app.post("/api/chat", async (req, res) => {
  const chatId = req.body.chatId || "demo"
  const message = typeof req.body.message === "string" ? req.body.message.trim() : ""
  if (!message) return res.status(400).json({ error: "message is required" })

  const box = getBox(chatId)
  box.logs.push({ source: "user", text: message })
  try {
    const result = await runner.run(demoAgent, message, { session: getSession(chatId) })
    const interruption = result.interruptions[0]
    if (interruption) {
      const waitId = randomUUID()
      waiting.set(waitId, { state: result.state, chatId })
      const payload = approvalPayload(waitId, interruption)
      box.logs.push({ source: "agent", text: `approval required for ${interruption.name}` })
      return res.status(202).json(payload)
    }

    const output = displayOutput(result.finalOutput)
    box.logs.push({ source: "agent", text: output })
    return res.json({ status: "completed", output })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown agent error"
    console.error("[chat] error", message)
    return res.status(500).json({ error: "Agent request failed. Check the backend terminal for details." })
  }
})

// Retired deliberately: holding this response open while waiting for human
// approval was the source of the stuck chat. Clients must use /api/chat.
app.post("/api/chat/stream", (_req, res) => {
  res.status(410).json({ error: "Streaming chat is retired. Use POST /api/chat." })
})

app.post("/api/approvals/:waitId", async (req, res) => {
  console.log("[approval] id:", req.params.waitId, "body:", req.body)
  const job = waiting.get(req.params.waitId)
  if (!job) return res.status(404).json({ error: "wrong id" })
  const ok = req.body.decision === "approve"
  const item = job.state.getInterruptions()[0]
  if (!item) {
    waiting.delete(req.params.waitId)
    return res.status(409).json({ error: "approval is no longer pending" })
  }
  if (ok) job.state.approve(item); else job.state.reject(item)
  waiting.delete(req.params.waitId)
  try {
    const resumed = await runner.run(demoAgent, job.state)
    const interruption = resumed.interruptions[0]
    if (interruption) {
      const waitId = randomUUID()
      waiting.set(waitId, { state: resumed.state, chatId: job.chatId })
      return res.status(202).json(approvalPayload(waitId, interruption))
    }
    const output = displayOutput(resumed.finalOutput)
    getBox(job.chatId).logs.push({ source: "agent", text: output })
    return res.json({ status: "completed", output })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown approval resume error"
    console.error("[approval] resume error", message)
    return res.status(500).json({ error: "Email action failed. Check the backend terminal for details." })
  }
})

app.get("/api/logs/stream", (req, res) => {
  console.log("[logs] query:", req.query)
  res.writeHead(200, { "Content-Type": "text/plain", "Connection": "keep-alive" })
  const box = history.get(req.query.chatId || "demo")
  if (!box) { res.write(JSON.stringify({ type: "log", text: "no data" }) + "\n"); return }
  box.logs.forEach(l => res.write(JSON.stringify({ type: "log", ...l }) + "\n"))
  let n = box.logs.length
  const t = setInterval(() => { for(let i=n;i<box.logs.length;i++) res.write(JSON.stringify({ type: "log", ...box.logs[i] })+"\n"); n=box.logs.length }, 500)
  req.on("close", () => clearInterval(t))
})

app.get("/api/trace/:chatId/stream", (req, res) => {
  console.log("[trace] chatId:", req.params.chatId)
  res.writeHead(200, { "Content-Type": "text/plain", "Connection": "keep-alive" })
  const box = history.get(req.params.chatId)
  if (!box) { res.write(JSON.stringify({ type: "trace", title: "no data" })+"\n"); return }
  box.traces.forEach(t => res.write(JSON.stringify({ type: "trace", ...t })+"\n"))
  let n = box.traces.length
  const timer = setInterval(() => { for(let i=n;i<box.traces.length;i++) res.write(JSON.stringify({ type: "trace", ...box.traces[i] })+"\n"); n=box.traces.length }, 500)
  req.on("close", () => clearInterval(timer))
})
app.get("/api/trace/stream", (req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain", "Connection": "keep-alive" })
  const box = Array.from(history.values()).pop()
  if (!box) { res.write(JSON.stringify({ type: "trace", title: "no data" })+"\n"); return }
  box.traces.forEach(t => res.write(JSON.stringify({ type: "trace", ...t })+"\n"))
})

app.get("/api/prompts", (req, res) => {
  console.log("[prompts] hit")
  res.json([{ version: "v15", current: true, lines: ["you are helpful"] }])
})
app.post("/api/prompts/rollback", (req, res) => {
  console.log("[rollback]", req.body)
  res.json({ ok: true, version: req.body.version })
})

app.listen(PORT, () => console.log(`server running on http://localhost:${PORT}`))
