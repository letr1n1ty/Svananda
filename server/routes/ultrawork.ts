import { Hono } from "hono";
import { createModuleLogger } from "../../lib/debug-log.ts";
import { safeJson } from "../hono-helpers.ts";

const log = createModuleLogger("ultrawork");

export function createUltraworkRoute(runtime) {
  const route = new Hono();

  route.get("/ultrawork/capabilities", (c) => {
    return c.json(runtime.capabilities());
  });

  route.get("/ultrawork/runs", (c) => {
    const limit = Number.parseInt(c.req.query("limit") || "20", 10);
    return c.json({ runs: runtime.listRuns({ limit: Number.isFinite(limit) ? limit : 20 }) });
  });

  route.get("/ultrawork/runs/:id", (c) => {
    const run = runtime.getRun(c.req.param("id"));
    if (!run) return c.json({ error: "ultrawork_run_not_found" }, 404);
    return c.json({ run });
  });

  route.post("/ultrawork/runs", async (c) => {
    try {
      const body = await safeJson(c);
      const run = await runtime.startRun({
        goal: body.goal,
        mode: body.mode,
        sessionPath: body.sessionPath,
        requestedAgents: Array.isArray(body.agents) ? body.agents : [],
      });
      return c.json({ ok: true, run });
    } catch (err) {
      log.error(`start failed: ${err.message}`);
      return c.json({ ok: false, error: err.message }, 400);
    }
  });

  route.post("/ultrawork/runs/:id/confirm", async (c) => {
    return action(c, "confirm", (id, body) => runtime.confirmRun(id, body));
  });

  route.post("/ultrawork/runs/:id/continue", async (c) => {
    return action(c, "continue", (id, body) => runtime.continueRun(id, body));
  });

  route.post("/ultrawork/runs/:id/cancel", async (c) => {
    return action(c, "cancel", (id, body) => runtime.cancelRun(id, body));
  });

  route.post("/ultrawork/runs/:id/packets/next/run", async (c) => {
    return action(c, "run-next-packet", (id, body) => runtime.runNextPacket(id, body));
  });

  route.post("/ultrawork/runs/:id/packets/:packetId/run", async (c) => {
    return action(c, "run-packet", (id, body) => runtime.runPacket(id, c.req.param("packetId"), body));
  });

  async function action(c, name, fn) {
    try {
      const body = await safeJson(c).catch(() => ({}));
      const run = await fn(c.req.param("id"), {
        actor: body.actor || "cli",
        reason: body.reason || null,
      });
      return c.json({ ok: true, run });
    } catch (err) {
      const status = err.message === "ultrawork_run_not_found" || err.message === "ultrawork_packet_not_found" ? 404 : 409;
      log.error(`${name} failed: ${err.message}`);
      return c.json({ ok: false, error: err.message }, status);
    }
  }

  return route;
}
