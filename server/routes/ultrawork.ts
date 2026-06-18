import { Hono } from "hono";
import { createModuleLogger } from "../../lib/debug-log.ts";
import { safeJson } from "../hono-helpers.ts";

const log = createModuleLogger("ultrawork");

export function createUltraworkRoute(runtime) {
  const route = new Hono();

  route.get("/ultrawork/capabilities", (c) => c.json(runtime.capabilities()));

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
      const message = errorMessage(err);
      log.error(`start failed: ${message}`);
      return c.json({ ok: false, error: message }, 400);
    }
  });

  route.post("/ultrawork/runs/:id/confirm", async (c) => action(c, "confirm", (id, body) => runtime.confirmRun(id, body)));
  route.post("/ultrawork/runs/:id/continue", async (c) => action(c, "continue", (id, body) => runtime.continueRun(id, body)));
  route.post("/ultrawork/runs/:id/cancel", async (c) => action(c, "cancel", (id, body) => runtime.cancelRun(id, body)));
  route.post("/ultrawork/runs/:id/artifacts/sync", async (c) => action(c, "sync-artifacts", (id, body) => runtime.exportArtifacts(id, body)));
  route.post("/ultrawork/runs/:id/packets/next/run", async (c) => action(c, "run-next-packet", (id, body) => runtime.runNextPacket(id, body)));
  route.post("/ultrawork/runs/:id/packets/:packetId/run", async (c) => action(c, "run-packet", (id, body) => runtime.runPacket(id, c.req.param("packetId"), body)));

  async function action(c, name, fn) {
    try {
      const body = await safeJson(c).catch(() => ({}));
      const run = await fn(c.req.param("id"), {
        actor: body.actor || "cli",
        reason: body.reason || null,
      });
      return c.json({ ok: true, run });
    } catch (err) {
      const message = errorMessage(err);
      const status = message === "ultrawork_run_not_found" || message === "ultrawork_packet_not_found" ? 404 : 409;
      log.error(`${name} failed: ${message}`);
      return c.json({ ok: false, error: message }, status);
    }
  }

  return route;
}

function errorMessage(err) {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "unknown_error";
  }
}
