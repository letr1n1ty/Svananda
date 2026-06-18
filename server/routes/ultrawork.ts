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
      const run = runtime.startRun({
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

  return route;
}
