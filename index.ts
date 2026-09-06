// @ts-nocheck - keep simple, no high level types
import express from "express"
import dotenv from "dotenv"
import { demoAgent, displayOutput, getSession, runner } from "./src/agent.ts"
import { randomUUID } from "node:crypto"

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000
app.use(express.json())

// save paused runs when agent needs approval
// key = approvalId, value = {state, sessionId, interruption, res}
const pendingRuns = new Map()

// helper to get session id safely
function sessionIdFrom(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "demo-session"
}

// ========== 1. HEALTH - simple check, use res.json() because one reply ==========
app.get("/health", (req, res) => {
  // res.json = send once and close
  res.json({ message: "api is working" })
})

// ========== 2. CHAT (old, no stream) - keep for simple testing ==========
// this waits till agent finishes, then sends one res.json
app.post("/api/chat", async (req, res) => {
  const { message, sessionId: rawSessionId } = req.body
  if (!message || !message.trim()) {
    return res.status(400).json({ error: "message is required" })
  }
  const sessionId = sessionIdFrom(rawSessionId)
  try {
    const result = await runner.run(demoAgent, message.trim(), {
      context: { userId: "demo-user", sessionId },
      session: getSession(sessionId),
    })
    // if agent needs approval, save state and tell frontend
    if (result.interruptions?.length) {
      const approvalId = randomUUID()
      pendingRuns.push(approvalId, { state: result.state, sessionId, interruption: result.interruptions[0] })
      return res.status(202).json({
        status: "awaiting_approval",
        approvalId,
        approvals: result.interruptions.map((i) => ({ toolName: i.name, arguments: i.arguments })),
      })
    }
    // normal finish - one res.json
    res.json({ status: "completed", output: displayOutput(result.finalOutput) })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "agent failed" })
  }
})

// ========== 3. CHAT STREAM - main streaming endpoint, uses res.write not res.json ==========
// why res.write? because we send MANY pieces: delta, log, trace, approval - not one
// res.json would close after first piece, so we keep connection open with res.writeHead
app.post("/api/chat/stream", async (req, res) => {
  // tell browser: we will stream, don't close
  // res.writeHead is just headers, not body
  res.writeHead(200, {
    "Content-Type": "text/event-stream", // SSE = server send events
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  })

  // helper to send one event: event: chat_delta\n data: {...}\n\n  <-- \n\n is important
  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  }

  const sessionId = sessionIdFrom(req.body.sessionId)
  const message = req.body.message
  if (!message || !message.trim()) {
    send("error", { message: "message is required" })
    return res.end()
  }

  try {
    send("log", { text: "agent started" })
    send("trace", { title: "prompt", kind: "prompt", text: message })

    // stream:true => SDK gives pieces one by one, not waiting for end
    const stream = await runner.run(demoAgent, message.trim(), {
      stream: true, // important for streaming
      context: { userId: "demo-user", sessionId },
      session: getSession(sessionId),
    })

    // loop over each piece from agent
    for await (const ev of stream) {
      // chat word piece
      if (ev.type === "raw_model_stream_event") {
        // ev.data.delta has small text piece
        const delta = ev.data.delta || ev.data.text || ""
        if (delta) send("chat_delta", { text: delta })
      }

      // tool called - for trace timeline
      if (ev.type === "run_item_stream_event" && ev.name === "tool_called") {
        send("trace", { kind: "tool", title: ev.item.rawItem.name, input: ev.item.rawItem.arguments })
        send("log", { text: `tool called ${ev.item.rawItem.name}` })
      }

      // tool finished
      if (ev.type === "run_item_stream_event" && ev.name === "tool_output") {
        send("log", { text: "tool finished" })
      }

      // APPROVAL NEEDED - agent wants human to approve
      if (ev.type === "run_item_stream_event" && ev.name === "tool_approval_requested") {
        const approvalId = randomUUID()
        // save paused work + the stream response so we can resume later
        pendingRuns.set(approvalId, {
          state: stream.state, // paused state
          sessionId,
          interruption: ev.item, // which tool needs approval
          res, // keep same res open to continue streaming after approval
        })
        // tell frontend to show popup: approval REQUIRED
        send("approval", {
          approvalId,
          toolName: ev.item.rawItem.name,
          arguments: ev.item.rawItem.arguments,
          message: "agent needs approval",
        })
        return // pause here, don't close res. wait for /api/approvals/:id
      }
    }

    // if no approval, finish
    send("done", { output: displayOutput(stream.finalOutput) })
    res.end() // now close connection
  } catch (e) {
    console.error(e)
    send("error", { message: "agent failed" })
    res.end()
  }
})

// ========== 4. APPROVAL - frontend calls when user clicks Approve/Reject ==========
// needs approvalId from previous stream event
app.post("/api/approvals/:approvalId", async (req, res) => {
  const pending = pendingRuns.get(req.params.approvalId)
  const decision = req.body.decision // "approve" or "reject"

  if (!pending || (decision !== "approve" && decision !== "reject")) {
    return res.status(400).json({ error: "wrong id or decision" })
  }

  // tell SDK if user approved or rejected
  if (decision === "approve") pending.state.approve(pending.interruption)
  else pending.state.reject(pending.interruption, { message: "user rejected" })

  pendingRuns.delete(req.params.approvalId)

  try {
    // resume same run from where it paused, with streaming again
    const resumed = await runner.run(demoAgent, pending.state, {
      stream: true,
      context: { userId: "demo-user", sessionId: pending.sessionId },
      session: getSession(pending.sessionId),
    })

    // continue sending to OLD stream response (the one from /api/chat/stream)
    for await (const ev of resumed) {
      if (ev.type === "raw_model_stream_event") {
        const delta = ev.data.delta || ""
        if (delta) pending.res.write(`event: chat_delta\ndata: ${JSON.stringify({ text: delta })}\n\n`)
      }
    }
    pending.res.write(`event: done\ndata: ${JSON.stringify({ output: displayOutput(resumed.finalOutput) })}\n\n`)
    pending.res.end()

    // also tell the approval caller it's done (for simple fetch)
    res.json({ status: "resumed", output: displayOutput(resumed.finalOutput) })
  } catch (e) {
    console.error(e)
    pending.res.write(`event: error\ndata: ${JSON.stringify({ message: "resume failed" })}\n\n`)
    pending.res.end()
    res.status(500).json({ error: "resume failed" })
  }
})

// ========== 5. LOGS STREAM - only logs, for LiveLogStream panel ==========
// frontend can do: new EventSource('/api/logs/stream')
app.get("/api/logs/stream", (req, res) => {
  res.writeHead(200, { "Content-Type": "text/event-stream", "Connection": "keep-alive", "Cache-Control": "no-cache" })
  const send = (data) => res.write(`event: log\ndata: ${JSON.stringify(data)}\n\n`)
  send({ text: "logs stream connected" })
  // fake heartbeat every 2 sec - replace with real logs from DB
  const timer = setInterval(() => {
    send({ time: new Date().toLocaleTimeString(), text: "heartbeat log" })
  }, 2000)
  req.on("close", () => clearInterval(timer)) // clean when browser closes
})

// ========== 6. TRACE STREAM - only trace spans, for TraceTimeline ==========
app.get("/api/trace/:runId/stream", (req, res) => {
  res.writeHead(200, { "Content-Type": "text/event-stream", "Connection": "keep-alive", "Cache-Control": "no-cache" })
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  // example spans - replace with real trace from your runner
  send("trace", { kind: "prompt", title: "Prompt", text: "you are helpful" })
  send("trace", { kind: "tool", title: "save_note", input: "title test" })
  // keep open
})

// ========== 7. PROMPTS - simple REST, no stream, so use res.json ==========
app.get("/api/prompts", (req, res) => {
  // res.json = one reply, fine for prompts
  res.json([
    { version: "v15", current: true, lines: ["you are helpful", "use tools"] },
    { version: "v14", lines: ["you are helpful"] },
  ])
})
app.post("/api/prompts/rollback", (req, res) => {
  res.json({ ok: true, rolledBackTo: req.body.version })
})

// start server
app.listen(PORT, () => {
  console.log(`server running on http://localhost:${PORT}`)
})
