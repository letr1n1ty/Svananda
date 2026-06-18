import { ansi, paint, createTerminalTheme } from "./terminal-theme.ts";

export async function runUltrawork(client, connection, args) {
  const goal = String(args.goal || "").trim();
  if (!goal) {
    console.error(`${ansi.red}ultrawork requires a goal${ansi.reset}`);
    console.error(`${ansi.dim}Example: hana ultrawork "ship the first Omni Ultrawork MVP" --auto${ansi.reset}`);
    return 1;
  }

  const health = await client.health().catch(() => ({}));
  const theme = createTerminalTheme(health.agentYuan);
  const result = await client.startUltrawork({
    goal,
    mode: args.mode,
    sessionPath: args.session,
    agents: args.agents,
  });
  const run = result.run;

  if (args.json) {
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
    const marker = step.status === "completed" ? `${ansi.green}✓${ansi.reset}` : step.status === "waiting_confirmation" ? `${ansi.yellow}!${ansi.reset}` : `${ansi.dim}·${ansi.reset}`;
    const confirm = step.requiresConfirmation ? ` ${ansi.yellow}[confirm]${ansi.reset}` : "";
    console.log(`  ${marker} ${idx + 1}. ${step.title}${confirm}`);
    console.log(`     ${ansi.dim}${step.agent} · ${step.kind} · risk:${step.risk} · ${step.status}${ansi.reset}`);
  }
  console.log("");

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
    console.log(`\n${ansi.yellow}This run is waiting for confirmation before autonomous execution.${ansi.reset}`);
  }
  return 0;
}
