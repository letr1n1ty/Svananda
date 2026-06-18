import { Hono } from "hono";
import { createModuleLogger } from "../../lib/debug-log.ts";
import { OmniUltraworkRuntime } from "../../core/ultrawork/runtime.ts";
import { callText } from "../../core/llm-client.ts";
import { createUltraworkRoute } from "./ultrawork.ts";

const log = createModuleLogger("commands");

export function createCommandsRoute(engine) {
  const route = new Hono();
  const ultraworkRuntime = new OmniUltraworkRuntime({
    hanakoHome: engine.hanakoHome,
    activityHub: engine.activityHub,
    textGenerator: createUltraworkTextGenerator(engine),
  });
  route.route("", createUltraworkRoute(ultraworkRuntime));

  route.get("/commands", (c) => {
    try {
      const registry = engine.slashRegistry;
      if (!registry) return c.json({ error: "slash system not ready" }, 503);
      const defs = registry.list().map((d) => ({
        name: d.name,
        aliases: d.aliases || [],
        description: d.description || "",
        permission: d.permission,
        scope: d.scope || "session",
        source: d.source || "core",
      }));
      return c.json({ commands: defs });
    } catch (err) {
      log.error(`list failed: ${err.message}`);
      return c.json({ error: err.message }, 500);
    }
  });

  return route;
}

function createUltraworkTextGenerator(engine) {
  return async ({ kind, run }) => {
    const agentId = run.sessionPath ? engine.agentIdFromSessionPath?.(run.sessionPath) || null : engine.currentAgentId || null;
    const utility = engine.resolveUtilityConfig({ agentId, sessionPath: run.sessionPath || null });
    const text = await callText({
      api: utility.api,
      apiKey: utility.api_key,
      baseUrl: utility.base_url,
      model: utility.utility,
      systemPrompt: buildUltraworkSystemPrompt(kind),
      messages: [
        {
          role: "user",
          content: buildUltraworkUserPrompt(kind, run),
        },
      ],
      temperature: kind === "plan" ? 0.2 : 0.1,
      maxTokens: kind === "plan" ? 1800 : 1000,
      usageLedger: utility.usageLedger,
      usageContext: {
        source: {
          subsystem: "ultrawork",
          operation: `generate_${kind}`,
          surface: run.sessionPath ? "desktop" : "cli",
          trigger: "command",
        },
        attribution: run.sessionPath
          ? { kind: "session", agentId: utility.usageAgentId || agentId || null, sessionPath: run.sessionPath }
          : { kind: "utility", agentId: utility.usageAgentId || agentId || null },
      },
    } as any);
    return { text, model: modelLabel(utility.utility) };
  };
}

function buildUltraworkSystemPrompt(kind) {
  if (kind === "review") {
    return "You are Miroku, the Ultrawork reviewer. Review the run for correctness, privacy, side effects, and permission-boundary violations. Be concrete and concise.";
  }
  return "You are Kannon, the Ultrawork planner. Convert the goal into a concrete multi-agent execution plan. Respect the mode, permissions, and confirmation gates.";
}

function buildUltraworkUserPrompt(kind, run) {
  const agents = run.agents.map((agent) => `- ${agent.name} (${agent.id}): ${agent.mission}`).join("\n");
  const steps = run.steps.map((step, index) => `- ${index + 1}. ${step.title} | agent=${step.agent} | kind=${step.kind} | status=${step.status} | risk=${step.risk} | confirm=${step.requiresConfirmation}`).join("\n");
  const permissions = Object.entries(run.permissions).map(([key, value]) => `- ${key}: ${Array.isArray(value) ? value.join(", ") : value}`).join("\n");
  return `Generate a ${kind} artifact for this Svananda Omni Ultrawork run.\n\nGoal: ${run.goal}\nMode: ${run.mode}\nIntent: ${run.intent}\nStatus: ${run.status}\nSession: ${run.sessionPath || "none"}\n\nAgents:\n${agents}\n\nExecution graph:\n${steps}\n\nPermission profile:\n${permissions}\n\nOutput requirements:\n- Markdown only.\n- Include concrete next actions.\n- Explicitly call out any actions that require confirmation.\n- Do not claim that tools were executed.\n`;
}

function modelLabel(model) {
  if (!model) return null;
  if (typeof model === "string") return model;
  return model.name || model.id || null;
}
