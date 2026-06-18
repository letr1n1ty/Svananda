import fs from "fs";
import path from "path";
import { Hono } from "hono";
import { createModuleLogger } from "../../lib/debug-log.ts";
import { OmniUltraworkRuntime, PacketRunnerRegistry } from "../../core/ultrawork/runtime.ts";
import { callText } from "../../core/llm-client.ts";
import {
  buildSessionFileSourceKey,
  sessionFilesCacheDir,
} from "../../lib/session-files/session-file-registry.ts";
import { createUltraworkRoute } from "./ultrawork.ts";

const log = createModuleLogger("commands");

export function createCommandsRoute(engine) {
  const route = new Hono();
  const ultraworkRuntime = new OmniUltraworkRuntime({
    hanakoHome: engine.hanakoHome,
    getActivityHub: () => engine.activityHub,
    textGenerator: createUltraworkTextGenerator(engine),
    artifactExporter: createUltraworkArtifactExporter(engine),
    packetRunnerRegistry: createUltraworkPacketRunnerRegistry(),
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

function createUltraworkPacketRunnerRegistry() {
  return PacketRunnerRegistry.noop().register("coding", "coding:skeleton-impact-map", ({ run, packet }) => {
    const title = `Coding impact map · ${packet.title}`;
    return {
      status: "completed",
      notes: `Coding runner skeleton produced ${title}. No files were read, written, or mutated.`,
      message: `Completed coding packet skeleton: ${packet.title}`,
      data: {
        runnerKind: "coding",
        producedArtifactTitle: title,
        mutationPerformed: false,
      },
      artifacts: [
        {
          kind: "note",
          title,
          agent: packet.agent,
          content: renderCodingPacketArtifact(run, packet),
          source: "system",
        },
      ],
    };
  });
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

function createUltraworkArtifactExporter(engine) {
  return async ({ run, artifact }) => {
    if (!run.sessionPath) return null;
    const dir = path.join(sessionFilesCacheDir(engine.hanakoHome, run.sessionPath), "ultrawork", run.id);
    fs.mkdirSync(dir, { recursive: true });
    const filename = `${artifact.kind}-${safeFilename(artifact.title || artifact.id)}.md`;
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, renderArtifactMarkdown(run, artifact), "utf-8");
    const sourceKey = buildSessionFileSourceKey("ultrawork-artifact", [run.id, artifact.id, artifact.kind]);
    const entry = engine.recordSessionFileOperation({
      sessionPath: run.sessionPath,
      filePath,
      label: `Ultrawork ${artifact.kind}: ${artifact.title}`,
      origin: "agent_artifact",
      operation: "created",
      storageKind: "managed_cache",
      presentation: "attachment",
      sourceKey,
    });
    return {
      fileId: entry?.id || null,
      filePath: entry?.filePath || filePath,
      displayName: entry?.displayName || filename,
      sourceKey,
    };
  };
}

function buildUltraworkSystemPrompt(kind) {
  if (kind === "review") {
    return "You are Miroku, the Ultrawork reviewer. Review the run for correctness, privacy, side effects, delegated packet quality, and permission-boundary violations. Be concrete and concise.";
  }
  return "You are Kannon, the Ultrawork planner. Convert the goal into a concrete multi-agent execution plan. Respect the mode, permissions, confirmation gates, and delegated work packets.";
}

function buildUltraworkUserPrompt(kind, run) {
  const agents = run.agents.map((agent) => `- ${agent.name} (${agent.id}): ${agent.mission}`).join("\n");
  const steps = run.steps.map((step, index) => `- ${index + 1}. ${step.title} | agent=${step.agent} | kind=${step.kind} | status=${step.status} | risk=${step.risk} | confirm=${step.requiresConfirmation}`).join("\n");
  const packets = (run.workPackets || []).map((packet, index) => `- ${index + 1}. ${packet.title} | agent=${packet.agent} | kind=${packet.kind} | status=${packet.status} | gates=${packet.confirmationGates.join(", ") || "none"}\n  objective: ${packet.objective}\n  deliverables: ${packet.deliverables.join(", ")}`).join("\n");
  const permissions = Object.entries(run.permissions).map(([key, value]) => `- ${key}: ${Array.isArray(value) ? value.join(", ") : value}`).join("\n");
  return `Generate a ${kind} artifact for this Svananda Omni Ultrawork run.\n\nGoal: ${run.goal}\nMode: ${run.mode}\nIntent: ${run.intent}\nStatus: ${run.status}\nSession: ${run.sessionPath || "none"}\n\nAgents:\n${agents}\n\nExecution graph:\n${steps}\n\nDelegated work packets:\n${packets || "none"}\n\nPermission profile:\n${permissions}\n\nOutput requirements:\n- Markdown only.\n- Include concrete next actions.\n- Explicitly call out any actions that require confirmation.\n- Do not claim that tools were executed.\n`;
}

function renderCodingPacketArtifact(run, packet) {
  return [
    `# Coding impact map · ${packet.title}`,
    "",
    `Run: ${run.id}`,
    `Goal: ${run.goal}`,
    `Mode: ${run.mode}`,
    `Intent: ${run.intent}`,
    "",
    "## Objective",
    packet.objective,
    "",
    "## File impact map",
    "- No repository files were read or changed by this skeleton runner.",
    "- Candidate file discovery is deferred to the real coding runner.",
    "- Any future mutation must pass the run permission profile and packet confirmation gates.",
    "",
    "## Implementation checklist",
    ...packet.deliverables.map((item) => `- Prepare: ${item}`),
    "",
    "## Test plan",
    "- Identify existing package scripts before running tests.",
    "- Prefer targeted typecheck/unit tests before full-suite execution.",
    "- Record commands and results in the packet audit trail.",
    "",
    "## Confirmation gates",
    ...(packet.confirmationGates.length ? packet.confirmationGates.map((gate) => `- ${gate}`) : ["- none"]),
    "",
    "## Mutation status",
    "No files were created, modified, deleted, or staged.",
    "",
  ].join("\n");
}

function renderArtifactMarkdown(run, artifact) {
  return [
    `# ${artifact.title}`,
    "",
    `- Run: ${run.id}`,
    `- Goal: ${run.goal}`,
    `- Mode: ${run.mode}`,
    `- Intent: ${run.intent}`,
    `- Agent: ${artifact.agent}`,
    `- Source: ${artifact.source}`,
    artifact.model ? `- Model: ${artifact.model}` : null,
    `- Created: ${artifact.createdAt}`,
    "",
    "---",
    "",
    artifact.content,
    "",
  ].filter(Boolean).join("\n");
}

function safeFilename(value) {
  return String(value || "artifact")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "artifact";
}

function modelLabel(model) {
  if (!model) return null;
  if (typeof model === "string") return model;
  return model.name || model.id || null;
}
