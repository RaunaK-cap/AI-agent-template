// @ts-nocheck - simple code, no high level types
import express from "express"
import dotenv from "dotenv"
import { demoAgent, displayOutput, getSession, runner } from "./src/agent.ts"
import { randomUUID } from "node:crypto"

dotenv.config()

const app = express()
const PORT = process.env.PORT || 8000 // use 8000 so dashboard (3000) doesn't clash
app.use(express.json())
// allow dashboard (nextjs) to call backend
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
  res.header("Access-Control-Allow-Headers", "Content-Type")
  if (req.method === "OPTIONS") return res.sendStatus(204)
  next()
})

// save paused runs when agent needs approval
const pendingRuns = new Map()

// save traces and logs per run, so frontend can get them later
// runId -> { logs: [], traces: [], sessionId }
const runs = new Map()

function sessionIdFrom(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "demo-session"
}

// helper to get or create run store
function getRun(runId) {
  if (!runs.has(runId)) runs.set(runId, { logs: [], traces: [], sessionId: "" })
  return runs.get(runId)
}

// ========== 1. HEALTH - use res.json (one reply) ==========
app.get("/health", (req, res) => {
  console.log("[GET /health] hit at", new Date().toISOString())
  res.json({ message: "api is working" })
})

// ========== 2. CHAT (no stream) - simple one res.json ==========
app.post("/api/chat", async (req, res) => {
  console.log("[POST /api/chat] body:", req.body)
  const { message, sessionId: rawSessionId } = req.body
  if (!message || !message.trim()) {
    console.log("[POST /api/chat] error: message missing")
    return res.status(400).json({ error: "message is required" })
  }
  const sessionId = sessionIdFrom(rawSessionId)
  console.log("[POST /api/chat] sessionId:", sessionId, "message:", message)
  try {
    const result = await runner.run(demoAgent, message.trim(), {
      context: { userId: "demo-user", sessionId },
      session: getSession(sessionId),
    })
    if (result.interruptions?.length) {
      const approvalId = randomUUID()
      pendingRuns.set(approvalId, { state: result.state, sessionId, interruption: result.interruptions[0] })
      console.log("[POST /api/chat] needs approval, approvalId:", approvalId)
      return res.status(202).json({
        status: "awaiting_approval",
        approvalId,
        approvals: result.interruptions.map((i) => ({ toolName: i.name, arguments: i.arguments })),
      })
    }
    console.log("[POST /api/chat] completed, output:", displayOutput(result.finalOutput))
    res.json({ status: "completed", output: displayOutput(result.finalOutput) })
  } catch (e) {
    console.log("[POST /api/chat] error:", e)
    console.error(e)
    res.status(500).json({ error: "agent failed" })
  }
})

// ========== 3. CHAT STREAM - main endpoint, streams everything from REAL agent ==========
// why res.write? because we send MANY pieces, not one
app.post("/api/chat/stream", async (req, res) => {
  console.log("[POST /api/chat/stream] hit, body:", req.body)
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  })

  const send = (event, data) => {
    console.log(`[STREAM] send event: ${event}`, data)
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  }

  const sessionId = sessionIdFrom(req.body.sessionId)
  const message = req.body.message
  if (!message || !message.trim()) {
    console.log("[POST /api/chat/stream] error: no message")
    send("error", { message: "message is required" })
    return res.end()
  }

  // create new runId for this chat, store traces/logs
  const runId = randomUUID()
  console.log("[POST /api/chat/stream] new runId:", runId, "sessionId:", sessionId)
  const runStore = getRun(runId)
  runStore.sessionId = sessionId
  runStore.runId = runId

  // helper to save trace and log for later /api/trace and /api/logs
  const saveTrace = (trace) => {
    runStore.traces.push(trace)
    send("trace", trace) // also send live to chat stream
  }
  const saveLog = (log) => {
    runStore.logs.push(log)
    send("log", log) // also send live
  }

  try {
    // trace from REAL prompt, not hardcode
    saveTrace({ id: randomUUID(), kind: "prompt", title: "Prompt", detail: message, timestamp: Date.now() })
    saveLog({ time: new Date().toLocaleTimeString(), source: "agent-event", text: `run ${runId} started` })

    const stream = await runner.run(demoAgent, message.trim(), {
      stream: true,
      context: { userId: "demo-user", sessionId },
      session: getSession(sessionId),
    })

    for await (const ev of stream) {
      // ----- REAL agent trace/logs from SDK events -----

      // 1. llm text piece -> chat + log
      if (ev.type === "raw_model_stream_event") {
        const delta = ev.data.delta || ev.data.text || ""
        if (delta) {
          send("chat_delta", { text: delta, runId })
          saveLog({ time: new Date().toLocaleTimeString(), source: "llm", text: delta.slice(0, 80) })
        }
      }

      // 2. tool called -> real trace from agent, not hardcode
      if (ev.type === "run_item_stream_event" && ev.name === "tool_called") {
        const toolName = ev.item.rawItem.name
        const args = ev.item.rawItem.arguments
        // real trace from agent response
        saveTrace({
          id: randomUUID(),
          kind: "tool",
          title: toolName,
          input: typeof args === "string" ? args : JSON.stringify(args),
          timestamp: Date.now(),
          runId,
        })
        saveLog({ time: new Date().toLocaleTimeString(), source: "tool", text: `tool call ${toolName}` })
      }

      // 3. tool result -> real log from agent
      if (ev.type === "run_item_stream_event" && ev.name === "tool_output") {
        const output = ev.item.rawItem.output || ""
        saveLog({ time: new Date().toLocaleTimeString(), source: "tool", text: `tool output ${String(output).slice(0, 80)}` })
        saveTrace({
          id: randomUUID(),
          kind: "tool",
          title: "tool result",
          output: String(output).slice(0, 200),
          runId,
        })
      }

      // 4. llm message done
      if (ev.type === "run_item_stream_event" && ev.name === "message_output_created") {
        saveTrace({ id: randomUUID(), kind: "llm", title: "Model", detail: "llm finished", runId })
      }

      // 5. agent changed
      if (ev.type === "agent_updated_stream_event") {
        saveTrace({ id: randomUUID(), kind: "agent", title: ev.agent.name, runId })
        saveLog({ time: new Date().toLocaleTimeString(), source: "agent-event", text: `agent ${ev.agent.name}` })
      }

      // 6. APPROVAL NEEDED - real interruption from SDK
      if (ev.type === "run_item_stream_event" && ev.name === "tool_approval_requested") {
        const approvalId = randomUUID()
        // don't store ev.item, store state - interruption comes from state.getInterruptions()
        pendingRuns.set(approvalId, {
          state: stream.state,
          sessionId,
          res, // keep same res open
          runId,
        })
        console.log("[STREAM] approval needed, approvalId:", approvalId, "tool:", ev.item.rawItem.name)
        // save approval trace
        saveTrace({ id: randomUUID(), kind: "tool", title: "needs approval", detail: ev.item.rawItem.name, runId })
        send("approval", {
          approvalId,
          runId,
          toolName: ev.item.rawItem.name,
          arguments: ev.item.rawItem.arguments,
          message: "agent needs approval",
        })
        return // pause, wait for POST /api/approvals/:id
      }
    }

    // done - real final output from agent
    const finalOutput = displayOutput(stream.finalOutput)
    console.log("[POST /api/chat/stream] done, runId:", runId, "output:", finalOutput)
    saveLog({ time: new Date().toLocaleTimeString(), source: "completed", text: `run ${runId} completed` })
    send("done", { output: finalOutput, runId })
    res.end()
  } catch (e) {
    console.log("[POST /api/chat/stream] error:", e)
    console.error(e)
    send("error", { message: "agent failed" })
    res.end()
  }
})

// ========== 4. APPROVAL - user clicks Approve/Reject ==========
app.post("/api/approvals/:approvalId", async (req, res) => {
  console.log("[POST /api/approvals/:id] hit, id:", req.params.approvalId, "body:", req.body)
  const pending = pendingRuns.get(req.params.approvalId)
  const decision = req.body.decision
  if (!pending || (decision !== "approve" && decision !== "reject")) {
    console.log("[POST /api/approvals] error: wrong id or decision")
    return res.status(400).json({ error: "wrong id or decision" })
  }
  console.log("[POST /api/approvals] decision:", decision, "for runId:", pending.runId)

  // get real interruption from state (not stored ev.item)
  const interruption = pending.state.getInterruptions()[0]
  if (!interruption) {
    console.log("[POST /api/approvals] no interruption found")
    return res.status(400).json({ error: "no interruption" })
  }
  console.log("[POST /api/approvals] interruption:", interruption.name)

  if (decision === "approve") pending.state.approve(interruption)
  else pending.state.reject(interruption, { message: "user rejected" })

  pendingRuns.delete(req.params.approvalId)
  const runStore = getRun(pending.runId)
  console.log("[POST /api/approvals] resuming run:", pending.runId)

  try {
    const resumed = await runner.run(demoAgent, pending.state, {
      stream: true,
      context: { userId: "demo-user", sessionId: pending.sessionId },
      session: getSession(pending.sessionId),
    })
    console.log("[POST /api/approvals] resumed, waiting for events...")

    for await (const ev of resumed) {
      console.log("[POST /api/approvals] resumed event:", ev.type, (ev as any).name || "")
      if (ev.type === "raw_model_stream_event") {
        const delta = ev.data.delta || ""
        if (delta) {
          const log = { time: new Date().toLocaleTimeString(), source: "llm", text: delta.slice(0, 80) }
          runStore.logs.push(log)
          pending.res.write(`event: chat_delta\ndata: ${JSON.stringify({ text: delta, runId: pending.runId })}\n\n`)
        }
      }
      if (ev.type === "run_item_stream_event") {
        console.log("[POST /api/approvals] run_item:", (ev as any).name, (ev as any).item?.rawItem?.name || "")
        if (ev.name === "tool_output") {
          const log = { time: new Date().toLocaleTimeString(), source: "tool", text: "tool output after approval" }
          runStore.logs.push(log)
          pending.res.write(`event: log\ndata: ${JSON.stringify(log)}\n\n`)
        }
      }
    }
    const finalOutput = displayOutput(resumed.finalOutput)
    console.log("[POST /api/approvals] done, output:", finalOutput)
    runStore.logs.push({ time: new Date().toLocaleTimeString(), source: "completed", text: "resumed completed" })
    pending.res.write(`event: done\ndata: ${JSON.stringify({ output: finalOutput, runId: pending.runId })}\n\n`)
    pending.res.end()

    res.json({ status: "resumed", output: finalOutput })
  } catch (e) {
    console.log("[POST /api/approvals] resume error:", e)
    console.error(e)
    pending.res.write(`event: error\ndata: ${JSON.stringify({ message: "resume failed" })}\n\n`)
    pending.res.end()
    res.status(500).json({ error: "resume failed" })
  }
})

// ========== 5. LOGS STREAM - REAL logs from agent, not hardcode ==========
app.get("/api/logs/stream", (req, res) => {
  console.log("[GET /api/logs/stream] hit, query:", req.query)
  res.writeHead(200, { "Content-Type": "text/event-stream", "Connection": "keep-alive", "Cache-Control": "no-cache" })
  const send = (data) => {
    console.log("[LOGS STREAM] send:", data)
    res.write(`event: log\ndata: ${JSON.stringify(data)}\n\n`)
  }

  const runId = req.query.runId
  let run = runId ? runs.get(runId) : Array.from(runs.values()).pop()
  console.log("[GET /api/logs/stream] run:", runId || "latest", "found:", !!run)

  if (!run) {
    send({ text: "no logs yet, start a chat first" })
  } else {
    run.logs.forEach((log) => send(log))
    let lastLen = run.logs.length
    const timer = setInterval(() => {
      if (run.logs.length > lastLen) {
        for (let i = lastLen; i < run.logs.length; i++) send(run.logs[i])
        lastLen = run.logs.length
      }
    }, 500)
    req.on("close", () => {
      console.log("[GET /api/logs/stream] closed")
      clearInterval(timer)
    })
    return
  }
  req.on("close", () => console.log("[GET /api/logs/stream] closed no run"))
})

// ========== 6. TRACE STREAM - REAL traces from agent, not hardcode ==========
app.get("/api/trace/:runId/stream", (req, res) => {
  console.log("[GET /api/trace/:runId/stream] hit, runId:", req.params.runId)
  res.writeHead(200, { "Content-Type": "text/event-stream", "Connection": "keep-alive", "Cache-Control": "no-cache" })
  const send = (data) => {
    console.log("[TRACE STREAM] send:", data)
    res.write(`event: trace\ndata: ${JSON.stringify(data)}\n\n`)
  }
  const run = runs.get(req.params.runId)
  if (!run) {
    send({ kind: "agent", title: "no trace yet", detail: "start chat to create run" })
    return
  }
  run.traces.forEach((t) => send(t))
  let lastLen = run.traces.length
  const timer = setInterval(() => {
    if (run.traces.length > lastLen) {
      for (let i = lastLen; i < run.traces.length; i++) send(run.traces[i])
      lastLen = run.traces.length
    }
  }, 500)
  req.on("close", () => {
    console.log("[GET /api/trace/:runId/stream] closed")
    clearInterval(timer)
  })
})

// also allow GET /api/trace/stream without id -> latest run
app.get("/api/trace/stream", (req, res) => {
  console.log("[GET /api/trace/stream] hit")
  res.writeHead(200, { "Content-Type": "text/event-stream", "Connection": "keep-alive", "Cache-Control": "no-cache" })
  const send = (data) => {
    console.log("[TRACE STREAM latest] send:", data)
    res.write(`event: trace\ndata: ${JSON.stringify(data)}\n\n`)
  }
  const run = Array.from(runs.values()).pop()
  if (!run) {
    send({ kind: "agent", title: "no trace yet" })
    return
  }
  run.traces.forEach((t) => send(t))
  let lastLen = run.traces.length
  const timer = setInterval(() => {
    if (run.traces.length > lastLen) {
      for (let i = lastLen; i < run.traces.length; i++) send(run.traces[i])
      lastLen = run.traces.length
    }
  }, 500)
  req.on("close", () => {
    console.log("[GET /api/trace/stream] closed")
    clearInterval(timer)
  })
})

// ========== 7. PROMPTS - simple REST, keep res.json ==========
app.get("/api/prompts", (req, res) => {
  console.log("[GET /api/prompts] hit")
  res.json([
    { version: "v15", current: true, lines: ["you are helpful", "use tools"] },
    { version: "v14", lines: ["you are helpful"] },
  ])
})
app.post("/api/prompts/rollback", (req, res) => {
  console.log("[POST /api/prompts/rollback] body:", req.body)
  res.json({ ok: true, rolledBackTo: req.body.version })
})

// start server
app.listen(PORT, () => {
  console.log(`server running on http://localhost:${PORT}`)
})
