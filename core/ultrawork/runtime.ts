import crypto from "crypto";
import fs from "fs";
import path from "path";

export const ULTRAWORK_MODES = ["safe", "auto", "godmode"] as const;
export const ULTRAWORK_INTENTS = ["coding", "product", "research", "personal_ops", "mixed"] as const;
export const ULTRAWORK_WORK_PACKET_KINDS = ["coding", "product", "research", "personal_ops", "review", "archive"] as const;

export type UltraworkMode = typeof ULTRAWORK_MODES[number];
export type UltraworkIntent = typeof ULTRAWORK_INTENTS[number];
export type UltraworkStatus = "queued" | "running" | "waiting_confirmation" | "completed" | "failed" | "cancelled";
export type UltraworkAgentRole = "hana" | "planner" | "researcher" | "coder" | "operator" | "reviewer" | "archivist";
export type UltraworkHookPhase = "before_plan" | "after_plan" | "before_tool" | "after_tool" | "before_mutation" | "after_review";
export type UltraworkArtifactKind = "plan" | "review" | "note";
export type UltraworkWorkPacketKind = typeof ULTRAWORK_WORK_PACKET_KINDS[number];

export type UltraworkAgentSpec = {
  id: UltraworkAgentRole;
  name: string;
  mission: string;
  autonomy: "observe" | "draft" | "operate" | "govern";
};

export type UltraworkStep = {
  id: string;
  title: string;
  agent: UltraworkAgentRole;
  status: UltraworkStatus;
  kind: "intent" | "plan" | "delegate" | "tool" | "review" | "deliver";
  risk: "low" | "medium" | "high";
  requiresConfirmation: boolean;
  createdAt: string;
  updatedAt: string;
  notes?: string;
};

export type UltraworkWorkPacket = {
  id: string;
  title: string;
  kind: UltraworkWorkPacketKind;
  agent: UltraworkAgentRole;
  status: UltraworkStatus;
  objective: string;
  inputs: string[];
  deliverables: string[];
  confirmationGates: string[];
  source: "deterministic" | "planner" | "system";
  createdAt: string;
  updatedAt: string;
  notes?: string;
};

export type UltraworkArtifactExport = {
  fileId?: string | null;
  filePath?: string | null;
  displayName?: string | null;
  sourceKey?: string | null;
};

export type UltraworkArtifact = {
  id: string;
  kind: UltraworkArtifactKind;
  title: string;
  agent: UltraworkAgentRole;
  content: string;
  source: "utility" | "deterministic" | "system";
  model?: string | null;
  exportedFile?: UltraworkArtifactExport | null;
  createdAt: string;
};

export type UltraworkArtifactDraft = Omit<UltraworkArtifact, "id" | "createdAt"> & {
  id?: string;
  createdAt?: string;
};

export type UltraworkAuditEvent = {
  id: string;
  at: string;
  type: string;
  actor: string;
  message: string;
  data?: Record<string, any>;
};

export type UltraworkRun = {
  id: string;
  goal: string;
  mode: UltraworkMode;
  intent: UltraworkIntent;
  status: UltraworkStatus;
  sessionPath: string | null;
  agents: UltraworkAgentSpec[];
  steps: UltraworkStep[];
  workPackets: UltraworkWorkPacket[];
  artifacts: UltraworkArtifact[];
  audit: UltraworkAuditEvent[];
  permissions: UltraworkPermissionProfile;
  createdAt: string;
  updatedAt: string;
};

export type UltraworkPermissionProfile = {
  canReadLocalContext: boolean;
  canSearchExternalSources: boolean;
  canDraftArtifacts: boolean;
  canMutateFiles: boolean;
  canWriteMemory: boolean;
  canSendExternalMessages: boolean;
  requiresConfirmationFor: string[];
};

export type StartUltraworkInput = {
  goal: string;
  mode?: string;
  sessionPath?: string | null;
  requestedAgents?: string[];
};

export type UltraworkActionInput = {
  actor?: string;
  reason?: string;
};

export type UltraworkTextRequest = {
  kind: "plan" | "review";
  run: UltraworkRun;
};

export type UltraworkTextResult = {
  text: string;
  model?: string | null;
};

export type UltraworkPacketRunnerInput = {
  run: UltraworkRun;
  packet: UltraworkWorkPacket;
  actor: string;
  reason?: string | null;
};

export type UltraworkPacketRunnerResult = {
  status?: "completed" | "failed";
  notes?: string;
  message?: string;
  data?: Record<string, any>;
  artifacts?: UltraworkArtifactDraft[];
};

export type UltraworkPacketRunner = (input: UltraworkPacketRunnerInput) => UltraworkPacketRunnerResult | Promise<UltraworkPacketRunnerResult> | null | undefined;
export type UltraworkTextGenerator = (request: UltraworkTextRequest) => Promise<UltraworkTextResult | string | null | undefined>;
export type UltraworkArtifactExporter = (request: { run: UltraworkRun; artifact: UltraworkArtifact }) => Promise<UltraworkArtifactExport | null | undefined>;

export class PacketRunnerRegistry {
  private readonly runners = new Map<UltraworkWorkPacketKind, { name: string; runner: UltraworkPacketRunner }>();

  register(kind: UltraworkWorkPacketKind, name: string, runner: UltraworkPacketRunner) {
    this.runners.set(kind, { name, runner });
    return this;
  }

  get(kind: UltraworkWorkPacketKind) {
    return this.runners.get(kind) || this.runners.get("review") || null;
  }

  describe() {
    return ULTRAWORK_WORK_PACKET_KINDS.map((kind) => ({ kind, name: this.runners.get(kind)?.name || null }));
  }

  static noop() {
    const registry = new PacketRunnerRegistry();
    for (const kind of ULTRAWORK_WORK_PACKET_KINDS) registry.register(kind, `noop:${kind}`, noopPacketRunner);
    return registry;
  }
}

export class OmniUltraworkRuntime {
  private runs = new Map<string, UltraworkRun>();
  private readonly storePath: string;
  private readonly activityHub: any;
  private readonly textGenerator: UltraworkTextGenerator | null;
  private readonly artifactExporter: UltraworkArtifactExporter | null;
  private readonly packetRunnerRegistry: PacketRunnerRegistry;

  constructor({ hanakoHome, activityHub = null, textGenerator = null, artifactExporter = null, packetRunnerRegistry = null }: {
    hanakoHome: string;
    activityHub?: any;
    textGenerator?: UltraworkTextGenerator | null;
    artifactExporter?: UltraworkArtifactExporter | null;
    packetRunnerRegistry?: PacketRunnerRegistry | null;
  }) {
    this.storePath = path.join(hanakoHome, "ultrawork", "runs.json");
    this.activityHub = activityHub || null;
    this.textGenerator = typeof textGenerator === "function" ? textGenerator : null;
    this.artifactExporter = typeof artifactExporter === "function" ? artifactExporter : null;
    this.packetRunnerRegistry = packetRunnerRegistry || PacketRunnerRegistry.noop();
    this.load();
  }

  capabilities() {
    return {
      modes: ULTRAWORK_MODES,
      intents: ULTRAWORK_INTENTS,
      agents: defaultAgentRoster(),
      lifecycleHooks: ["before_plan", "after_plan", "before_tool", "after_tool", "before_mutation", "after_review"] satisfies UltraworkHookPhase[],
      actions: ["confirm", "continue", "cancel", "run-packet", "run-next-packet"],
      activityKinds: ["workflow", "workflow_agent", "workflow_step"],
      artifactKinds: ["plan", "review", "note"],
      workPacketKinds: ULTRAWORK_WORK_PACKET_KINDS,
      packetRunners: this.packetRunnerRegistry.describe(),
      textGeneration: !!this.textGenerator,
      artifactExport: !!this.artifactExporter,
      packetRunner: "registry",
      runnerArtifactExport: !!this.artifactExporter,
    };
  }

  listRuns({ limit = 20 }: { limit?: number } = {}) {
    return Array.from(this.runs.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit);
  }

  getRun(id: string) {
    return this.runs.get(id) || null;
  }

  async startRun(input: StartUltraworkInput): Promise<UltraworkRun> {
    const goal = String(input.goal || "").trim();
    if (!goal) throw new Error("goal is required");
    const now = new Date().toISOString();
    const mode = normalizeMode(input.mode);
    const intent = inferIntent(goal);
    const permissions = permissionProfileForMode(mode);
    const agents = selectAgents(intent, input.requestedAgents);
    const run: UltraworkRun = {
      id: createRunId(),
      goal,
      mode,
      intent,
      status: mode === "safe" ? "waiting_confirmation" : "running",
      sessionPath: input.sessionPath || null,
      agents,
      steps: createInitialPlan({ goal, mode, intent, permissions }),
      workPackets: [],
      artifacts: [],
      audit: [],
      permissions,
      createdAt: now,
      updatedAt: now,
    };

    this.record(run, "run.created", "hana", "Created Omni Ultrawork run", { mode, intent });
    this.record(run, "intent.routed", "planner", `Routed goal as ${intent}`, { intent });
    this.record(run, "agents.selected", "planner", `Selected ${agents.length} agent roles`, { agents: agents.map((agent) => agent.id) });
    this.record(run, "permissions.applied", "reviewer", `Applied ${mode} permission profile`, permissions);
    this.record(run, "plan.generated", "planner", "Generated initial multi-agent execution graph", { stepCount: run.steps.length });

    this.generateWorkPackets(run);
    await this.generateInitialArtifacts(run);
    this.runs.set(run.id, run);
    this.publishActivity(run);
    this.save();
    return run;
  }

  confirmRun(id: string, input: UltraworkActionInput = {}) {
    const run = this.requireRun(id);
    this.assertMutable(run);
    if (run.status !== "waiting_confirmation") {
      this.record(run, "run.confirm.noop", input.actor || "hana", "Confirmation received, but run was not waiting", { status: run.status });
      this.publishActivity(run);
      this.save();
      return run;
    }
    run.status = "running";
    markWaitingSteps(run, "queued");
    this.record(run, "run.confirmed", input.actor || "hana", "Confirmed safe-mode Ultrawork plan", { reason: input.reason || null });
    this.publishActivity(run);
    this.save();
    return run;
  }

  continueRun(id: string, input: UltraworkActionInput = {}) {
    const run = this.requireRun(id);
    this.assertMutable(run);
    if (run.status === "waiting_confirmation") {
      this.record(run, "run.continue.blocked", input.actor || "hana", "Run requires confirmation before continuation");
      this.publishActivity(run);
      this.save();
      return run;
    }
    if (run.status === "queued") run.status = "running";
    this.record(run, "run.continued", input.actor || "hana", "Continued Ultrawork run", { reason: input.reason || null });
    this.advanceSkeleton(run, input.actor || "hana");
    this.publishActivity(run);
    this.save();
    return run;
  }

  async runNextPacket(id: string, input: UltraworkActionInput = {}) {
    const run = this.requireRun(id);
    const packet = (run.workPackets || []).find((candidate) => !isTerminalStatus(candidate.status));
    if (!packet) {
      this.record(run, "work_packet.run_next.noop", input.actor || "hana", "No runnable work packets remain");
      this.maybeCompleteRun(run);
      this.publishActivity(run);
      this.save();
      return run;
    }
    return await this.runPacket(id, packet.id, input);
  }

  async runPacket(id: string, packetId: string, input: UltraworkActionInput = {}) {
    const run = this.requireRun(id);
    this.assertMutable(run);
    if (run.status === "waiting_confirmation") {
      this.record(run, "work_packet.run.blocked", input.actor || "hana", "Run requires confirmation before packet execution", { packetId });
      this.publishActivity(run);
      this.save();
      return run;
    }

    const packet = (run.workPackets || []).find((candidate) => candidate.id === packetId);
    if (!packet) throw new Error("ultrawork_packet_not_found");
    if (isTerminalStatus(packet.status)) {
      this.record(run, "work_packet.run.noop", input.actor || "hana", "Packet is already terminal", { packetId, status: packet.status });
      this.publishActivity(run);
      this.save();
      return run;
    }

    const entry = this.packetRunnerRegistry.get(packet.kind);
    if (!entry) throw new Error("ultrawork_packet_runner_not_found");
    const actor = input.actor || "hana";
    run.status = "running";
    packet.status = "running";
    packet.updatedAt = new Date().toISOString();
    this.record(run, "work_packet.started", packet.agent, `Started work packet: ${packet.title}`, { packetId: packet.id, kind: packet.kind, actor, runner: entry.name });

    let result: UltraworkPacketRunnerResult | null | undefined;
    try {
      result = await entry.runner({ run, packet, actor, reason: input.reason || null });
    } catch (err: any) {
      result = { status: "failed", notes: `Packet runner failed: ${err?.message || String(err)}`, message: "Packet runner failed", data: { error: err?.message || String(err) } };
    }

    const producedArtifacts = await this.addRunnerArtifacts(run, packet, entry.name, result?.artifacts || []);
    const nextStatus = result?.status === "failed" ? "failed" : "completed";
    packet.status = nextStatus;
    packet.updatedAt = new Date().toISOString();
    packet.notes = appendNote(packet.notes, result?.notes || `Packet runner ${entry.name} completed this packet.`);
    this.record(run, nextStatus === "failed" ? "work_packet.failed" : "work_packet.completed", packet.agent, result?.message || `${nextStatus === "failed" ? "Failed" : "Completed"} work packet: ${packet.title}`, {
      packetId: packet.id,
      kind: packet.kind,
      actor,
      runner: entry.name,
      confirmationGates: packet.confirmationGates,
      producedArtifactIds: producedArtifacts.map((artifact) => artifact.id),
      exportedFileIds: producedArtifacts.map((artifact) => artifact.exportedFile?.fileId).filter(Boolean),
      ...(result?.data || {}),
    });

    this.maybeCompleteRun(run);
    this.publishActivity(run);
    this.save();
    return run;
  }

  cancelRun(id: string, input: UltraworkActionInput = {}) {
    const run = this.requireRun(id);
    if (run.status === "completed") {
      this.record(run, "run.cancel.noop", input.actor || "hana", "Completed run cannot be cancelled", { reason: input.reason || null });
      this.publishActivity(run);
      this.save();
      return run;
    }
    if (run.status !== "cancelled") {
      const now = new Date().toISOString();
      run.status = "cancelled";
      for (const step of run.steps) {
        if (step.status !== "completed") {
          step.status = "cancelled";
          step.updatedAt = now;
        }
      }
      for (const packet of run.workPackets || []) {
        if (packet.status !== "completed") {
          packet.status = "cancelled";
          packet.updatedAt = now;
        }
      }
      this.record(run, "run.cancelled", input.actor || "hana", "Cancelled Ultrawork run", { reason: input.reason || null });
    }
    this.publishActivity(run);
    this.save();
    return run;
  }

  private generateWorkPackets(run: UltraworkRun) {
    const packets = createDeterministicWorkPackets(run);
    run.workPackets.push(...packets);
    this.record(run, "work_packets.generated", "planner", `Generated ${packets.length} delegated work packets`, { packetIds: packets.map((packet) => packet.id), packetKinds: packets.map((packet) => packet.kind) });
  }

  private async generateInitialArtifacts(run: UltraworkRun) {
    await this.generateArtifact(run, "plan", "Kannon plan", "planner", deterministicPlanContent(run));
    await this.generateArtifact(run, "review", "Miroku review", "reviewer", deterministicReviewContent(run));
  }

  private async generateArtifact(run: UltraworkRun, kind: "plan" | "review", title: string, agent: UltraworkAgentRole, fallbackContent: string) {
    let content = fallbackContent;
    let source: UltraworkArtifact["source"] = "deterministic";
    let model: string | null = null;
    if (this.textGenerator) {
      try {
        const result = await this.textGenerator({ kind, run });
        const text = typeof result === "string" ? result : result?.text;
        if (typeof text === "string" && text.trim()) {
          content = text.trim();
          source = "utility";
          model = typeof result === "object" && result?.model ? result.model : null;
        }
      } catch (err: any) {
        this.record(run, "artifact.generation_failed", agent, `Failed to generate ${kind} artifact; using deterministic fallback`, { error: err?.message || String(err) });
      }
    }

    const artifact = await this.addArtifact(run, { kind, title, agent, content, source, model });
    this.record(run, "artifact.generated", agent, `Generated ${kind} artifact`, { artifactId: artifact.id, source, model });
    return artifact;
  }

  private async addRunnerArtifacts(run: UltraworkRun, packet: UltraworkWorkPacket, runner: string, artifacts: UltraworkArtifactDraft[]) {
    const added: UltraworkArtifact[] = [];
    for (const draft of artifacts) {
      const artifact = await this.addArtifact(run, draft);
      added.push(artifact);
      this.record(run, "artifact.generated", packet.agent, `Generated runner artifact: ${artifact.title}`, {
        artifactId: artifact.id,
        packetId: packet.id,
        runner,
        source: artifact.source,
      });
    }
    return added;
  }

  private async addArtifact(run: UltraworkRun, draft: UltraworkArtifactDraft) {
    const artifact: UltraworkArtifact = {
      id: draft.id || crypto.randomUUID(),
      kind: draft.kind,
      title: draft.title,
      agent: draft.agent,
      content: draft.content,
      source: draft.source,
      model: draft.model || null,
      createdAt: draft.createdAt || new Date().toISOString(),
    };
    run.artifacts.push(artifact);
    await this.exportArtifact(run, artifact);
    return artifact;
  }

  private async exportArtifact(run: UltraworkRun, artifact: UltraworkArtifact) {
    if (!this.artifactExporter || !run.sessionPath) return;
    try {
      const exported = await this.artifactExporter({ run, artifact });
      if (exported) {
        artifact.exportedFile = exported;
        this.record(run, "artifact.exported", "archivist", `Exported ${artifact.kind} artifact to session file`, {
          artifactId: artifact.id,
          fileId: exported.fileId || null,
          filePath: exported.filePath || null,
          sourceKey: exported.sourceKey || null,
        });
      }
    } catch (err: any) {
      this.record(run, "artifact.export_failed", "archivist", `Failed to export ${artifact.kind} artifact`, { artifactId: artifact.id, error: err?.message || String(err) });
    }
  }

  private advanceSkeleton(run: UltraworkRun, actor: string) {
    const now = new Date().toISOString();
    for (const step of run.steps) {
      if (step.status === "completed" || step.status === "cancelled") continue;
      step.status = "completed";
      step.updatedAt = now;
      step.notes = appendNote(step.notes, "Skeleton lifecycle advanced this step; real tool execution is not wired yet.");
      this.record(run, "step.completed", step.agent, `Completed step: ${step.title}`, { stepId: step.id, kind: step.kind, actor });
    }
    for (const packet of run.workPackets || []) {
      if (packet.status === "completed" || packet.status === "cancelled") continue;
      packet.status = "completed";
      packet.updatedAt = now;
      packet.notes = appendNote(packet.notes, "Skeleton lifecycle marked this packet complete; real delegated execution is not wired yet.");
      this.record(run, "work_packet.completed", packet.agent, `Completed work packet: ${packet.title}`, { packetId: packet.id, kind: packet.kind, actor, runner: "skeleton" });
    }
    this.maybeCompleteRun(run);
  }

  private maybeCompleteRun(run: UltraworkRun) {
    const packets = run.workPackets || [];
    if (packets.length && packets.every((packet) => isTerminalStatus(packet.status))) {
      const now = new Date().toISOString();
      for (const step of run.steps) {
        if (step.status !== "completed" && step.status !== "cancelled") {
          step.status = "completed";
          step.updatedAt = now;
        }
      }
      run.status = packets.some((packet) => packet.status === "failed") ? "failed" : "completed";
      this.record(run, run.status === "failed" ? "run.failed" : "run.completed", "reviewer", run.status === "failed" ? "Failed skeleton Ultrawork run after packet lifecycle advancement" : "Completed skeleton Ultrawork run after packet lifecycle advancement", { caveat: "This is a skeleton completion. Tool execution, memory writes, file mutation, and PR creation are still gated future work." });
    }
  }

  private publishActivity(run: UltraworkRun) {
    if (!this.activityHub || typeof this.activityHub.upsert !== "function") return;
    const parentTaskId = `ultrawork:${run.id}`;
    const startedAt = toMs(run.createdAt);
    const finishedAt = isTerminalStatus(run.status) ? toMs(run.updatedAt) : null;
    this.activityHub.upsert({ id: parentTaskId, kind: "workflow", status: toActivityStatus(run.status), sessionPath: run.sessionPath, agentId: "hana", agentName: "Hana", summary: `Omni Ultrawork · ${run.goal}`, label: `${run.mode} · ${run.intent}`, access: run.mode, startedAt, finishedAt });
    for (const agent of run.agents) {
      this.activityHub.upsert({ id: `${parentTaskId}:agent:${agent.id}`, kind: "workflow_agent", status: toActivityStatus(run.status), sessionPath: run.sessionPath, agentId: agent.id, agentName: agent.name, summary: agent.mission, label: agent.name, access: agent.autonomy, parentTaskId, phaseLabel: `${run.mode} · ${run.intent}`, startedAt, finishedAt });
    }
    for (const [idx, step] of run.steps.entries()) {
      this.activityHub.upsert({ id: `${parentTaskId}:step:${step.id}`, kind: "workflow_step", status: toActivityStatus(step.status), sessionPath: run.sessionPath, agentId: step.agent, agentName: displayNameForAgent(step.agent), summary: step.notes || step.title, label: `${idx + 1}. ${step.title}`, access: step.requiresConfirmation ? "confirm" : run.mode, parentTaskId, phaseLabel: step.agent, stepKind: step.kind, startedAt: toMs(step.createdAt), finishedAt: isTerminalStatus(step.status) ? toMs(step.updatedAt) : null });
    }
    for (const [idx, packet] of (run.workPackets || []).entries()) {
      this.activityHub.upsert({ id: `${parentTaskId}:packet:${packet.id}`, kind: "workflow_step", status: toActivityStatus(packet.status), sessionPath: run.sessionPath, agentId: packet.agent, agentName: displayNameForAgent(packet.agent), summary: packet.objective, label: `Packet ${idx + 1}. ${packet.title}`, access: packet.confirmationGates.length ? "confirm" : run.mode, parentTaskId, phaseLabel: packet.agent, stepKind: "work_packet", runner: this.packetRunnerRegistry.get(packet.kind)?.name || null, startedAt: toMs(packet.createdAt), finishedAt: isTerminalStatus(packet.status) ? toMs(packet.updatedAt) : null });
    }
  }

  private requireRun(id: string) {
    const run = this.getRun(id);
    if (!run) throw new Error("ultrawork_run_not_found");
    return run;
  }

  private assertMutable(run: UltraworkRun) {
    if (run.status === "cancelled") throw new Error("ultrawork_run_cancelled");
    if (run.status === "failed") throw new Error("ultrawork_run_failed");
  }

  private record(run: UltraworkRun, type: string, actor: string, message: string, data?: Record<string, any>) {
    run.audit.push({ id: crypto.randomUUID(), at: new Date().toISOString(), type, actor, message, data });
    run.updatedAt = new Date().toISOString();
  }

  private load() {
    try {
      if (!fs.existsSync(this.storePath)) return;
      const raw = JSON.parse(fs.readFileSync(this.storePath, "utf-8"));
      const runs = Array.isArray(raw?.runs) ? raw.runs : [];
      for (const run of runs) {
        if (run?.id) {
          if (!Array.isArray(run.artifacts)) run.artifacts = [];
          if (!Array.isArray(run.workPackets)) run.workPackets = [];
          this.runs.set(run.id, run);
        }
      }
    } catch {
      this.runs.clear();
    }
  }

  private save() {
    fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
    fs.writeFileSync(this.storePath, JSON.stringify({ runs: this.listRuns({ limit: 200 }) }, null, 2));
  }
}

function noopPacketRunner({ packet }: UltraworkPacketRunnerInput): UltraworkPacketRunnerResult {
  return { status: "completed", notes: `No-op ${packet.kind} runner completed this packet. Real tool execution is not wired yet.`, message: `Completed work packet: ${packet.title}`, data: { runnerKind: packet.kind } };
}

function normalizeMode(value: string | undefined): UltraworkMode {
  if (value === "safe" || value === "auto" || value === "godmode") return value;
  return "auto";
}

function inferIntent(goal: string): UltraworkIntent {
  const lower = goal.toLowerCase();
  const codingSignals = ["repo", "code", "bug", "test", "pr", "typescript", "github", "cli", "server"];
  const productSignals = ["prd", "roadmap", "feature", "spec", "product", "ux", "design"];
  const researchSignals = ["research", "compare", "citation", "source", "survey", "report"];
  const personalSignals = ["email", "calendar", "telegram", "memory", "note", "schedule", "todo"];
  const hits = { coding: countSignals(lower, codingSignals), product: countSignals(lower, productSignals), research: countSignals(lower, researchSignals), personal_ops: countSignals(lower, personalSignals) };
  const active = Object.entries(hits).filter(([, count]) => count > 0);
  if (active.length > 1) return "mixed";
  if (active.length === 1) return active[0][0] as UltraworkIntent;
  return "mixed";
}

function countSignals(value: string, signals: string[]) {
  return signals.reduce((count, signal) => count + (value.includes(signal) ? 1 : 0), 0);
}

function permissionProfileForMode(mode: UltraworkMode): UltraworkPermissionProfile {
  if (mode === "safe") {
    return { canReadLocalContext: true, canSearchExternalSources: false, canDraftArtifacts: true, canMutateFiles: false, canWriteMemory: false, canSendExternalMessages: false, requiresConfirmationFor: ["tool_use", "file_mutation", "memory_write", "external_send", "pull_request"] };
  }
  if (mode === "godmode") {
    return { canReadLocalContext: true, canSearchExternalSources: true, canDraftArtifacts: true, canMutateFiles: true, canWriteMemory: false, canSendExternalMessages: false, requiresConfirmationFor: ["memory_write", "external_send", "credential_access", "payment", "destructive_action"] };
  }
  return { canReadLocalContext: true, canSearchExternalSources: true, canDraftArtifacts: true, canMutateFiles: false, canWriteMemory: false, canSendExternalMessages: false, requiresConfirmationFor: ["file_mutation", "memory_write", "external_send", "pull_request"] };
}

function defaultAgentRoster(): UltraworkAgentSpec[] {
  return [
    { id: "hana", name: "Hana", mission: "Own the user-facing objective and final synthesis.", autonomy: "govern" },
    { id: "planner", name: "Kannon", mission: "Decompose goals, detect ambiguity, and maintain the execution graph.", autonomy: "draft" },
    { id: "researcher", name: "Librarian", mission: "Collect, verify, and cite external or internal evidence.", autonomy: "observe" },
    { id: "coder", name: "Hephaestus", mission: "Read, modify, and validate code when permission allows.", autonomy: "operate" },
    { id: "operator", name: "Seiji", mission: "Operate tools, files, desktop surfaces, and external integrations.", autonomy: "operate" },
    { id: "reviewer", name: "Miroku", mission: "Review risk, correctness, privacy, and side effects before delivery.", autonomy: "govern" },
    { id: "archivist", name: "Archivist", mission: "Persist audit trails, session summaries, and memory candidates.", autonomy: "draft" },
  ];
}

function selectAgents(intent: UltraworkIntent, requestedAgents: string[] = []) {
  const roster = defaultAgentRoster();
  const required = new Set<UltraworkAgentRole>(["hana", "planner", "reviewer", "archivist"]);
  if (intent === "coding" || intent === "mixed") required.add("coder");
  if (intent === "research" || intent === "product" || intent === "mixed") required.add("researcher");
  if (intent === "personal_ops" || intent === "mixed") required.add("operator");
  for (const agent of requestedAgents) if (roster.some((spec) => spec.id === agent)) required.add(agent as UltraworkAgentRole);
  return roster.filter((agent) => required.has(agent.id));
}

function createInitialPlan({ goal, mode, intent, permissions }: { goal: string; mode: UltraworkMode; intent: UltraworkIntent; permissions: UltraworkPermissionProfile }): UltraworkStep[] {
  const now = new Date().toISOString();
  const steps: Array<Omit<UltraworkStep, "id" | "createdAt" | "updatedAt">> = [
    { title: "Route intent and load context", agent: "planner", status: "completed", kind: "intent", risk: "low", requiresConfirmation: false, notes: `Goal classified as ${intent}: ${goal}` },
    { title: "Create multi-agent execution graph", agent: "planner", status: mode === "safe" ? "waiting_confirmation" : "completed", kind: "plan", risk: "medium", requiresConfirmation: mode === "safe", notes: "First version produces a deterministic execution graph before real tool execution is wired in." },
    { title: "Delegate specialist work packets", agent: "hana", status: "queued", kind: "delegate", risk: "medium", requiresConfirmation: mode === "safe", notes: "Delegation roster is selected by intent and permission mode." },
    { title: "Run permitted tools and collect evidence", agent: intent === "coding" ? "coder" : intent === "personal_ops" ? "operator" : "researcher", status: "queued", kind: "tool", risk: permissions.canMutateFiles ? "high" : "medium", requiresConfirmation: permissions.requiresConfirmationFor.includes("tool_use"), notes: "Tool execution is permission-gated. Mutations stay blocked unless the selected mode allows them." },
    { title: "Review risk, privacy, and correctness", agent: "reviewer", status: "queued", kind: "review", risk: "medium", requiresConfirmation: false, notes: "Reviewer is always present, including godmode." },
    { title: "Deliver result and persist audit trail", agent: "archivist", status: "queued", kind: "deliver", risk: "low", requiresConfirmation: false, notes: "Audit trail is persisted under HANA_HOME/ultrawork/runs.json." },
  ];
  return steps.map((step) => ({ ...step, id: crypto.randomUUID(), createdAt: now, updatedAt: now }));
}

function createDeterministicWorkPackets(run: UltraworkRun): UltraworkWorkPacket[] {
  const now = new Date().toISOString();
  const packets: Array<Omit<UltraworkWorkPacket, "id" | "createdAt" | "updatedAt">> = [];
  const hasAgent = (agent: UltraworkAgentRole) => run.agents.some((spec) => spec.id === agent);
  if (hasAgent("researcher") && (run.intent === "research" || run.intent === "product" || run.intent === "mixed")) {
    packets.push({ title: run.intent === "product" ? "Product discovery packet" : "Research evidence packet", kind: run.intent === "product" ? "product" : "research", agent: "researcher", status: "queued", objective: run.intent === "product" ? "Clarify product requirements, UX implications, acceptance criteria, and open questions without mutating project state." : "Collect and organize evidence, source requirements, uncertainty, and follow-up research questions without claiming external work was completed.", inputs: ["goal", "intent", "permission profile", "Kannon plan artifact"], deliverables: run.intent === "product" ? ["requirements outline", "acceptance criteria", "edge cases", "open decisions"] : ["source checklist", "evidence summary", "uncertainty log", "citation requirements"], confirmationGates: gateSubset(run, ["external_send", "memory_write"]), source: "deterministic" });
  }
  if (hasAgent("coder") && (run.intent === "coding" || run.intent === "mixed")) {
    packets.push({ title: "Coding implementation packet", kind: "coding", agent: "coder", status: "queued", objective: "Identify target files, proposed changes, verification commands, and rollback strategy before any file mutation or pull request.", inputs: ["goal", "execution graph", "permission profile", "repo context when available"], deliverables: ["file impact map", "implementation checklist", "test plan", "mutation candidates"], confirmationGates: gateSubset(run, ["file_mutation", "pull_request", "destructive_action"]), source: "deterministic" });
  }
  if (hasAgent("operator") && (run.intent === "personal_ops" || run.intent === "mixed")) {
    packets.push({ title: "Personal operations packet", kind: "personal_ops", agent: "operator", status: "queued", objective: "Prepare drafts, schedules, message candidates, and external action proposals while keeping side effects gated.", inputs: ["goal", "session context", "permission profile", "available integrations"], deliverables: ["draft actions", "integration checklist", "privacy review inputs", "confirmation requests"], confirmationGates: gateSubset(run, ["external_send", "memory_write", "payment", "credential_access"]), source: "deterministic" });
  }
  packets.push({ title: "Risk review packet", kind: "review", agent: "reviewer", status: "queued", objective: "Review delegated outputs for correctness, privacy, permission-boundary violations, and irreversible effects before delivery.", inputs: ["all work packets", "permission profile", "audit trail", "generated artifacts"], deliverables: ["risk summary", "blocked actions", "safe-to-proceed recommendation", "confirmation checklist"], confirmationGates: run.permissions.requiresConfirmationFor, source: "deterministic" });
  packets.push({ title: "Archive and handoff packet", kind: "archive", agent: "archivist", status: "queued", objective: "Persist the audit trail, artifacts, packet state, and handoff summary for later resume or review.", inputs: ["run record", "artifacts", "activity state", "session files when available"], deliverables: ["audit log", "artifact references", "resume summary", "memory candidates if approved"], confirmationGates: gateSubset(run, ["memory_write"]), source: "deterministic" });
  return packets.map((packet) => ({ ...packet, id: crypto.randomUUID(), createdAt: now, updatedAt: now }));
}

function deterministicPlanContent(run: UltraworkRun) {
  const agents = run.agents.map((agent) => `${agent.name} (${agent.id})`).join(", ");
  const steps = run.steps.map((step, index) => `${index + 1}. ${step.title} [${step.agent}/${step.kind}/risk:${step.risk}]`).join("\n");
  const packets = (run.workPackets || []).map((packet, index) => `${index + 1}. ${packet.title} [${packet.agent}/${packet.kind}] -> ${packet.deliverables.join(", ")}`).join("\n");
  return `# Ultrawork Plan\n\nGoal: ${run.goal}\nMode: ${run.mode}\nIntent: ${run.intent}\nAgents: ${agents}\n\n## Execution graph\n${steps}\n\n## Delegated work packets\n${packets || "none"}\n\n## Permission boundary\n${run.permissions.requiresConfirmationFor.join(", ") || "none"}\n`;
}

function deterministicReviewContent(run: UltraworkRun) {
  const highRiskSteps = run.steps.filter((step) => step.risk === "high").map((step) => step.title);
  const gatedPackets = (run.workPackets || []).filter((packet) => packet.confirmationGates.length > 0).map((packet) => packet.title);
  return `# Ultrawork Review\n\nStatus: ${run.status}\nReviewer: Miroku\n\n## Risk summary\n- High-risk steps: ${highRiskSteps.length ? highRiskSteps.join("; ") : "none"}\n- Gated work packets: ${gatedPackets.length ? gatedPackets.join("; ") : "none"}\n- External sends allowed: ${run.permissions.canSendExternalMessages}\n- Memory writes allowed: ${run.permissions.canWriteMemory}\n- File mutation allowed: ${run.permissions.canMutateFiles}\n\n## Gate recommendation\nProceed only within the ${run.mode} permission profile. Require explicit confirmation for: ${run.permissions.requiresConfirmationFor.join(", ") || "none"}.\n`;
}

function gateSubset(run: UltraworkRun, gates: string[]) {
  return gates.filter((gate) => run.permissions.requiresConfirmationFor.includes(gate));
}

function markWaitingSteps(run: UltraworkRun, nextStatus: UltraworkStatus) {
  const now = new Date().toISOString();
  for (const step of run.steps) {
    if (step.status === "waiting_confirmation") {
      step.status = nextStatus;
      step.updatedAt = now;
    }
  }
}

function toActivityStatus(status: UltraworkStatus) {
  if (status === "completed") return "done";
  if (status === "cancelled") return "aborted";
  if (status === "failed") return "failed";
  return "running";
}

function isTerminalStatus(status: UltraworkStatus) {
  return status === "completed" || status === "cancelled" || status === "failed";
}

function toMs(value: string | null | undefined) {
  const ms = value ? Date.parse(value) : NaN;
  return Number.isFinite(ms) ? ms : null;
}

function displayNameForAgent(agent: UltraworkAgentRole) {
  return defaultAgentRoster().find((spec) => spec.id === agent)?.name || agent;
}

function appendNote(existing: string | undefined, note: string) {
  return existing ? `${existing}\n${note}` : note;
}

function createRunId() {
  return `uw_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
}
