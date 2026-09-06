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

const waiting = new Map() // waitId -> {state, res, chatId}
const history = new Map() // chatId -> {logs:[], traces:[]}

function getBox(chatId) {
  if (!history.has(chatId)) history.set(chatId, { logs: [], traces: [] })
  return history.get(chatId)
}

app.get("/health", (req, res) => {
  console.log("[health] hit")
  res.json({ message: "api is working" })
})

// chat stream - simple JSON lines, no event/data
app.post("/api/chat/stream", async (req, res) => {
  console.log("[chat/stream] body:", req.body)
  res.writeHead(200, { "Content-Type": "text/plain", "Cache-Control": "no-cache", "Connection": "keep-alive" })
  // simple send: one JSON per line
  const send = (obj) => {
    console.log("[stream]", obj)
    res.write(JSON.stringify(obj) + "\n")
  }
  const chatId = req.body.chatId || "demo"
  const message = req.body.message
  if (!message) { send({ type: "error", message: "need message" }); return res.end() }

  const box = getBox(chatId)
  box.logs.push({ source: "user", text: message })
  send({ type: "log", source: "user", text: message })

  try {
    const stream = await runner.run(demoAgent, message, { stream: true, session: getSession(chatId) })
    for await (const ev of stream) {
      if (ev.type === "raw_model_stream_event" && ev.data.delta) {
        send({ type: "chat_delta", text: ev.data.delta })
      }
      if (ev.type === "run_item_stream_event" && ev.name === "tool_called") {
        const t = { type: "trace", kind: "tool", title: ev.item.rawItem.name, input: ev.item.rawItem.arguments }
        box.traces.push(t); send(t)
        const log = { type: "log", source: "tool", text: `tool ${t.title}` }
        box.logs.push(log); send(log)
      }
      if (ev.type === "run_item_stream_event" && ev.name === "tool_approval_requested") {
        const waitId = randomUUID()
        waiting.set(waitId, { state: stream.state, res, chatId })
        console.log("[stream] approval", waitId)
        send({ type: "approval", waitId, toolName: ev.item.rawItem.name, arguments: ev.item.rawItem.arguments })
        return
      }
    }
    const out = displayOutput(stream.finalOutput)
    send({ type: "done", output: out })
    res.end()
  } catch (e) {
    console.log("[stream] error", e)
    send({ type: "error", message: "failed" })
    res.end()
  }
})

app.post("/api/approvals/:waitId", async (req, res) => {
  console.log("[approval] id:", req.params.waitId, "body:", req.body)
  const job = waiting.get(req.params.waitId)
  if (!job) return res.status(404).json({ error: "wrong id" })
  const ok = req.body.decision === "approve"
  const item = job.state.getInterruptions()[0]
  if (ok) job.state.approve(item); else job.state.reject(item)
  waiting.delete(req.params.waitId)
  try {
    const resumed = await runner.run(demoAgent, job.state, { stream: true, session: getSession(job.chatId) })
    for await (const ev of resumed) {
      if (ev.type === "raw_model_stream_event" && ev.data.delta) {
        job.res.write(JSON.stringify({ type: "chat_delta", text: ev.data.delta }) + "\n")
      }
    }
    const out = displayOutput(resumed.finalOutput)
    job.res.write(JSON.stringify({ type: "done", output: out }) + "\n")
    job.res.end()
    res.json({ status: "resumed", output: out })
  } catch (e) {
    job.res.write(JSON.stringify({ type: "error" }) + "\n"); job.res.end()
    res.status(500).json({ error: "resume failed" })
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
