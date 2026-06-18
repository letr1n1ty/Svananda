import crypto from "crypto";
import fs from "fs";
import path from "path";

export const ULTRAWORK_MODES = ["safe", "auto", "godmode"] as const;
export const ULTRAWORK_INTENTS = ["coding", "product", "research", "personal_ops", "mixed"] as const;

export type UltraworkMode = typeof ULTRAWORK_MODES[number];
export type UltraworkIntent = typeof ULTRAWORK_INTENTS[number];
export type UltraworkStatus = "queued" | "running" | "waiting_confirmation" | "completed" | "failed" | "cancelled";
export type UltraworkAgentRole = "hana" | "planner" | "researcher" | "coder" | "operator" | "reviewer" | "archivist";
export type UltraworkHookPhase = "before_plan" | "after_plan" | "before_tool" | "after_tool" | "before_mutation" | "after_review";

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

export class OmniUltraworkRuntime {
  private runs = new Map<string, UltraworkRun>();
  private readonly storePath: string;

  constructor({ hanakoHome }: { hanakoHome: string }) {
    this.storePath = path.join(hanakoHome, "ultrawork", "runs.json");
    this.load();
  }

  capabilities() {
    return {
      modes: ULTRAWORK_MODES,
      intents: ULTRAWORK_INTENTS,
      agents: defaultAgentRoster(),
      lifecycleHooks: [
        "before_plan",
        "after_plan",
        "before_tool",
        "after_tool",
        "before_mutation",
        "after_review",
      ] satisfies UltraworkHookPhase[],
      actions: ["confirm", "continue", "cancel"],
    };
  }

  listRuns({ limit = 20 }: { limit?: number } = {}) {
    return Array.from(this.runs.values())
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit);
  }

  getRun(id: string) {
    return this.runs.get(id) || null;
  }

  startRun(input: StartUltraworkInput): UltraworkRun {
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
      audit: [],
      permissions,
      createdAt: now,
      updatedAt: now,
    };

    this.record(run, "run.created", "hana", "Created Omni Ultrawork run", { mode, intent });
    this.record(run, "intent.routed", "planner", `Routed goal as ${intent}`, { intent });
    this.record(run, "agents.selected", "planner", `Selected ${agents.length} agent roles`, {
      agents: agents.map((agent) => agent.id),
    });
    this.record(run, "permissions.applied", "reviewer", `Applied ${mode} permission profile`, permissions);
    this.record(run, "plan.generated", "planner", "Generated initial multi-agent execution plan", {
      stepCount: run.steps.length,
    });

    this.runs.set(run.id, run);
    this.save();
    return run;
  }

  confirmRun(id: string, input: UltraworkActionInput = {}) {
    const run = this.requireRun(id);
    this.assertMutable(run);
    if (run.status !== "waiting_confirmation") {
      this.record(run, "run.confirm.noop", input.actor || "hana", "Confirmation received, but run was not waiting", {
        status: run.status,
      });
      this.save();
      return run;
    }
    run.status = "running";
    markWaitingSteps(run, "queued");
    this.record(run, "run.confirmed", input.actor || "hana", "Confirmed safe-mode Ultrawork plan", {
      reason: input.reason || null,
    });
    this.advanceSkeleton(run, input.actor || "hana");
    this.save();
    return run;
  }

  continueRun(id: string, input: UltraworkActionInput = {}) {
    const run = this.requireRun(id);
    this.assertMutable(run);
    if (run.status === "waiting_confirmation") {
      this.record(run, "run.continue.blocked", input.actor || "hana", "Run requires confirmation before continuation");
      this.save();
      return run;
    }
    if (run.status === "queued") run.status = "running";
    this.record(run, "run.continued", input.actor || "hana", "Continued Ultrawork run", {
      reason: input.reason || null,
    });
    this.advanceSkeleton(run, input.actor || "hana");
    this.save();
    return run;
  }

  cancelRun(id: string, input: UltraworkActionInput = {}) {
    const run = this.requireRun(id);
    if (run.status === "completed") {
      this.record(run, "run.cancel.noop", input.actor || "hana", "Completed run cannot be cancelled", {
        reason: input.reason || null,
      });
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
      this.record(run, "run.cancelled", input.actor || "hana", "Cancelled Ultrawork run", {
        reason: input.reason || null,
      });
    }
    this.save();
    return run;
  }

  private advanceSkeleton(run: UltraworkRun, actor: string) {
    const now = new Date().toISOString();
    for (const step of run.steps) {
      if (step.status === "completed" || step.status === "cancelled") continue;
      step.status = "completed";
      step.updatedAt = now;
      step.notes = appendNote(step.notes, "Skeleton lifecycle advanced this step; real tool execution is not wired yet.");
      this.record(run, "step.completed", step.agent, `Completed step: ${step.title}`, {
        stepId: step.id,
        kind: step.kind,
        actor,
      });
    }
    run.status = "completed";
    this.record(run, "run.completed", "reviewer", "Completed skeleton Ultrawork run after lifecycle advancement", {
      caveat: "This is a skeleton completion. Tool execution, memory writes, file mutation, and PR creation are still gated future work.",
    });
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
    run.audit.push({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      type,
      actor,
      message,
      data,
    });
    run.updatedAt = new Date().toISOString();
  }

  private load() {
    try {
      if (!fs.existsSync(this.storePath)) return;
      const raw = JSON.parse(fs.readFileSync(this.storePath, "utf-8"));
      const runs = Array.isArray(raw?.runs) ? raw.runs : [];
      for (const run of runs) {
        if (run?.id) this.runs.set(run.id, run);
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
  const hits = {
    coding: countSignals(lower, codingSignals),
    product: countSignals(lower, productSignals),
    research: countSignals(lower, researchSignals),
    personal_ops: countSignals(lower, personalSignals),
  };
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
    return {
      canReadLocalContext: true,
      canSearchExternalSources: false,
      canDraftArtifacts: true,
      canMutateFiles: false,
      canWriteMemory: false,
      canSendExternalMessages: false,
      requiresConfirmationFor: ["tool_use", "file_mutation", "memory_write", "external_send", "pull_request"],
    };
  }
  if (mode === "godmode") {
    return {
      canReadLocalContext: true,
      canSearchExternalSources: true,
      canDraftArtifacts: true,
      canMutateFiles: true,
      canWriteMemory: false,
      canSendExternalMessages: false,
      requiresConfirmationFor: ["memory_write", "external_send", "credential_access", "payment", "destructive_action"],
    };
  }
  return {
    canReadLocalContext: true,
    canSearchExternalSources: true,
    canDraftArtifacts: true,
    canMutateFiles: false,
    canWriteMemory: false,
    canSendExternalMessages: false,
    requiresConfirmationFor: ["file_mutation", "memory_write", "external_send", "pull_request"],
  };
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
  for (const agent of requestedAgents) {
    if (roster.some((spec) => spec.id === agent)) required.add(agent as UltraworkAgentRole);
  }
  return roster.filter((agent) => required.has(agent.id));
}

function createInitialPlan({
  goal,
  mode,
  intent,
  permissions,
}: {
  goal: string;
  mode: UltraworkMode;
  intent: UltraworkIntent;
  permissions: UltraworkPermissionProfile;
}): UltraworkStep[] {
  const now = new Date().toISOString();
  const steps: Array<Omit<UltraworkStep, "id" | "createdAt" | "updatedAt">> = [
    {
      title: "Route intent and load context",
      agent: "planner",
      status: "completed",
      kind: "intent",
      risk: "low",
      requiresConfirmation: false,
      notes: `Goal classified as ${intent}: ${goal}`,
    },
    {
      title: "Create multi-agent execution graph",
      agent: "planner",
      status: mode === "safe" ? "waiting_confirmation" : "completed",
      kind: "plan",
      risk: "medium",
      requiresConfirmation: mode === "safe",
      notes: "First version produces a deterministic execution graph before real tool execution is wired in.",
    },
    {
      title: "Delegate specialist work packets",
      agent: "hana",
      status: "queued",
      kind: "delegate",
      risk: "medium",
      requiresConfirmation: mode === "safe",
      notes: "Delegation roster is selected by intent and permission mode.",
    },
    {
      title: "Run permitted tools and collect evidence",
      agent: intent === "coding" ? "coder" : intent === "personal_ops" ? "operator" : "researcher",
      status: "queued",
      kind: "tool",
      risk: permissions.canMutateFiles ? "high" : "medium",
      requiresConfirmation: permissions.requiresConfirmationFor.includes("tool_use"),
      notes: "Tool execution is permission-gated. Mutations stay blocked unless the selected mode allows them.",
    },
    {
      title: "Review risk, privacy, and correctness",
      agent: "reviewer",
      status: "queued",
      kind: "review",
      risk: "medium",
      requiresConfirmation: false,
      notes: "Reviewer is always present, including godmode.",
    },
    {
      title: "Deliver result and persist audit trail",
      agent: "archivist",
      status: "queued",
      kind: "deliver",
      risk: "low",
      requiresConfirmation: false,
      notes: "Audit trail is persisted under HANA_HOME/ultrawork/runs.json.",
    },
  ];

  return steps.map((step) => ({
    ...step,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  }));
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

function appendNote(existing: string | undefined, note: string) {
  return existing ? `${existing}\n${note}` : note;
}

function createRunId() {
  return `uw_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
}
