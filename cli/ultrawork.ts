import { ansi, paint, createTerminalTheme } from "./terminal-theme.ts";

export async function runUltrawork(client, connection, args) {
  const health = await client.health().catch(() => ({}));
  const theme = createTerminalTheme(health.agentYuan);

  if (args.ultraworkAction === "list") {
    const result = await client.ultraworkRuns({ limit: args.limit });
    if (args.json) {
      console.log(JSON.stringify(result.runs || [], null, 2));
      return 0;
    }
    renderRunList(result.runs || [], theme);
    return 0;
  }

  if (args.ultraworkAction === "show") {
    const run = await loadRun(client, args.ultraworkRunId);
    return renderRun(run, { theme, connection, json: args.json });
  }

  if (args.ultraworkAction === "confirm") {
    const run = (await client.confirmUltraworkRun(requireRunId(args), { reason: args.reason })).run;
    return renderRun(run, { theme, connection, json: args.json });
  }

  if (args.ultraworkAction === "continue") {
    const run = (await client.continueUltraworkRun(requireRunId(args), { reason: args.reason })).run;
    return renderRun(run, { theme, connection, json: args.json });
  }

  if (args.ultraworkAction === "cancel") {
    const run = (await client.cancelUltraworkRun(requireRunId(args), { reason: args.reason })).run;
    return renderRun(run, { theme, connection, json: args.json });
  }

  const goal = String(args.goal || "").trim();
  if (!goal) {
    console.error(`${ansi.red}ultrawork requires a goal${ansi.reset}`);
    console.error(`${ansi.dim}Example: hana ultrawork "ship the first Omni Ultrawork MVP" --auto${ansi.reset}`);
    return 1;
  }

  const result = await client.startUltrawork({
    goal,
    mode: args.mode,
    sessionPath: args.session,
    agents: args.agents,
  });
  return renderRun(result.run, { theme, connection, json: args.json });
}

async function loadRun(client, id) {
  const runId = String(id || "").trim();
  if (!runId) throw new Error("ultrawork run id is required");
  return (await client.getUltraworkRun(runId)).run;
}

function requireRunId(args) {
  const runId = String(args.ultraworkRunId || "").trim();
  if (!runId) throw new Error(`${args.ultraworkAction} requires a run id`);
  return runId;
}

function renderRun(run, { theme, connection, json }) {
  if (json) {
    console.log(JSON.stringify(run, null, 2));
    return 0;
  }

  console.log(`${paint(theme, theme.symbol)} Omni Ultrawork`);
  console.log(`  ${ansi.dim}Server${ansi.reset}   ${connection.baseUrl}`);
  console.log(`  ${ansi.dim}Run${ansi.reset}      ${run.id}`);
  console.log(`  ${ansi.dim}Mode${ansi.reset}     ${run.mode}`);
  console.log(`  ${ansi.dim}Intent${ansi.reset}   ${run.intent}`);
  console.log(`  ${ansi.dim}Status${ansi.reset}   ${run.status}`);
  console.log(`  ${ansi.dim}Goal${ansi.reset}     ${run.goal}`);
  console.log("");

  console.log(`${ansi.bold}Agents${ansi.reset}`);
  for (const agent of run.agents) {
    console.log(`  ${paint(theme, "•")} ${agent.name} ${ansi.dim}${agent.id} · ${agent.autonomy}${ansi.reset}`);
    console.log(`    ${ansi.dim}${agent.mission}${ansi.reset}`);
  }
  console.log("");

  console.log(`${ansi.bold}Plan${ansi.reset}`);
  for (const [idx, step] of run.steps.entries()) {
    const marker = markerForStatus(step.status);
    const confirm = step.requiresConfirmation ? ` ${ansi.yellow}[confirm]${ansi.reset}` : "";
    console.log(`  ${marker} ${idx + 1}. ${step.title}${confirm}`);
    console.log(`     ${ansi.dim}${step.agent} · ${step.kind} · risk:${step.risk} · ${step.status}${ansi.reset}`);
  }
  console.log("");

  if (Array.isArray(run.workPackets) && run.workPackets.length) {
    console.log(`${ansi.bold}Work packets${ansi.reset}`);
    for (const [idx, packet] of run.workPackets.entries()) {
      const marker = markerForStatus(packet.status);
      const gates = packet.confirmationGates?.length ? ` ${ansi.yellow}[gates: ${packet.confirmationGates.join(", ")}]${ansi.reset}` : "";
      console.log(`  ${marker} ${idx + 1}. ${packet.title}${gates}`);
      console.log(`     ${ansi.dim}${packet.agent} · ${packet.kind} · ${packet.status}${ansi.reset}`);
      console.log(`     ${packet.objective}`);
      if (Array.isArray(packet.deliverables) && packet.deliverables.length) {
        console.log(`     ${ansi.dim}deliverables: ${packet.deliverables.join(", ")}${ansi.reset}`);
      }
    }
    console.log("");
  }

  if (Array.isArray(run.artifacts) && run.artifacts.length) {
    console.log(`${ansi.bold}Artifacts${ansi.reset}`);
    for (const artifact of run.artifacts) {
      const model = artifact.model ? ` · ${artifact.model}` : "";
      console.log(`  ${paint(theme, "◈")} ${artifact.title} ${ansi.dim}${artifact.kind} · ${artifact.agent} · ${artifact.source}${model}${ansi.reset}`);
      if (artifact.exportedFile?.fileId || artifact.exportedFile?.displayName) {
        const name = artifact.exportedFile.displayName || artifact.exportedFile.filePath || "session file";
        const id = artifact.exportedFile.fileId ? ` · ${artifact.exportedFile.fileId}` : "";
        console.log(`    ${ansi.dim}file: ${name}${id}${ansi.reset}`);
      }
      console.log(indentPreview(artifact.content, "    "));
    }
    console.log("");
  }

  console.log(`${ansi.bold}Permission profile${ansi.reset}`);
  for (const [key, value] of Object.entries(run.permissions)) {
    const rendered = Array.isArray(value) ? value.join(", ") : String(value);
    console.log(`  ${ansi.dim}${key}${ansi.reset} ${rendered}`);
  }
  console.log("");

  console.log(`${ansi.bold}Audit${ansi.reset}`);
  for (const event of run.audit) {
    console.log(`  ${ansi.dim}${event.at}${ansi.reset} ${event.actor}: ${event.message}`);
  }

  if (run.status === "waiting_confirmation") {
    console.log(`\n${ansi.yellow}This run is waiting for confirmation. Run:${ansi.reset} hana ultrawork confirm ${run.id}`);
  } else if (run.status === "running" || run.status === "queued") {
    console.log(`\n${ansi.dim}Continue with:${ansi.reset} hana ultrawork continue ${run.id}`);
  }
  return 0;
}

function renderRunList(runs, theme) {
  if (!runs.length) {
    console.log(`${ansi.dim}No Ultrawork runs yet.${ansi.reset}`);
    return;
  }
  for (const run of runs) {
    const packets = Array.isArray(run.workPackets) ? ` · packets:${run.workPackets.length}` : "";
    const artifacts = Array.isArray(run.artifacts) ? ` · artifacts:${run.artifacts.length}` : "";
    const files = Array.isArray(run.artifacts) ? run.artifacts.filter((artifact) => artifact.exportedFile?.fileId).length : 0;
    const exported = files ? ` · files:${files}` : "";
    console.log(`${paint(theme, "•")} ${run.id} ${ansi.dim}${run.status} · ${run.mode} · ${run.intent}${packets}${artifacts}${exported}${ansi.reset}`);
    console.log(`  ${run.goal}`);
  }
}

function indentPreview(content, prefix) {
  const text = String(content || "").trim();
  if (!text) return `${prefix}${ansi.dim}(empty)${ansi.reset}`;
  const lines = text.split(/\r?\n/).slice(0, 12);
  const truncated = text.split(/\r?\n/).length > lines.length;
  return lines.map((line) => `${prefix}${line}`).join("\n") + (truncated ? `\n${prefix}${ansi.dim}...${ansi.reset}` : "");
}

function markerForStatus(status) {
  if (status === "completed") return `${ansi.green}✓${ansi.reset}`;
  if (status === "waiting_confirmation") return `${ansi.yellow}!${ansi.reset}`;
  if (status === "cancelled") return `${ansi.red}×${ansi.reset}`;
  if (status === "running") return `${ansi.green}▶${ansi.reset}`;
  return `${ansi.dim}·${ansi.reset}`;
}
