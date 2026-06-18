const COMMANDS = new Set(["serve", "status", "sessions", "continue", "chat", "ultrawork", "help"]);

export function parseCliArgs(argv = []) {
  const args = Array.from(argv);
  const command = args[0] && !args[0].startsWith("-") ? args.shift() : "help";
  if (!COMMANDS.has(command)) {
    return { command: "help", error: `unknown command: ${command}` };
  }

  const result = {
    command,
    plain: false,
    json: false,
    mode: "auto",
    url: null,
    token: null,
    session: null,
    target: null,
    goal: null,
    agents: [],
    passthrough: [],
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--plain") {
      result.plain = true;
    } else if (arg === "--json") {
      result.json = true;
    } else if (arg === "--safe") {
      result.mode = "safe";
    } else if (arg === "--auto") {
      result.mode = "auto";
    } else if (arg === "--godmode") {
      result.mode = "godmode";
    } else if (arg === "--mode") {
      result.mode = normalizeUltraworkMode(requireValue(args, ++i, "--mode"));
    } else if (arg === "--agent") {
      result.agents.push(requireValue(args, ++i, "--agent"));
    } else if (arg === "--url") {
      result.url = requireValue(args, ++i, "--url");
    } else if (arg === "--token") {
      result.token = requireValue(args, ++i, "--token");
    } else if (arg === "--session") {
      result.session = requireValue(args, ++i, "--session");
    } else if (arg === "--") {
      result.passthrough = args.slice(i + 1);
      if (command === "ultrawork" && !result.goal) result.goal = result.passthrough.join(" ").trim();
      break;
    } else if (command === "continue" && !result.target) {
      result.target = arg;
    } else if (command === "ultrawork") {
      result.goal = [result.goal, arg].filter(Boolean).join(" ").trim();
    } else {
      result.passthrough.push(arg);
    }
  }

  return result;
}

function requireValue(args, index, flag) {
  const value = args[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function normalizeUltraworkMode(value) {
  if (value === "safe" || value === "auto" || value === "godmode") return value;
  throw new Error(`unknown ultrawork mode: ${value}`);
}

export function helpText() {
  return `Hana CLI

Usage:
  hana serve [-- server args]        Start a headless HanaAgent Server
  hana status                       Show local server and agent status
  hana sessions                     List recent sessions
  hana continue [index|path]        Continue a recent session
  hana chat [--plain]               Open chat
  hana ultrawork <goal>             Start an Omni Ultrawork run

Ultrawork options:
  --safe                            Plan first; confirmation-heavy autonomy
  --auto                            Default autonomy with gated mutations
  --godmode                         Max autonomous loop; high-risk actions still gated
  --agent <id>                      Request an additional specialist agent
  --json                            Print raw run JSON

Connection options:
  --url <baseUrl>                   Connect to a specific HanaAgent Server
  --token <token>                   Bearer token for that server
  --session <path>                  Chat or run Ultrawork in a specific session
`;
}
