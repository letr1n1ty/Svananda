# Omni Ultrawork MVP

Omni Ultrawork is the Svananda counterpart to an agent-harness `ultrawork` mode: one user goal enters the system, then Hana routes intent, selects specialist agents, applies a permission profile, creates a resumable execution graph, and persists an audit trail.

## CLI

```bash
hana ultrawork "ship the first Omni Ultrawork MVP" --auto
hana ultrawork "audit my repo and propose the next PR" --safe
hana ultrawork "finish the whole feature with tests" --godmode --json
```

## API

```txt
GET  /api/ultrawork/capabilities
GET  /api/ultrawork/runs?limit=20
GET  /api/ultrawork/runs/:id
POST /api/ultrawork/runs
```

Example body:

```json
{
  "goal": "ship the first Omni Ultrawork MVP",
  "mode": "auto",
  "sessionPath": null,
  "agents": ["coder", "reviewer"]
}
```

## Modes

| Mode | Meaning |
| --- | --- |
| `safe` | Plan-first mode. It creates the run and waits for confirmation before autonomous execution. |
| `auto` | Default mode. It can route, plan, delegate, search, and draft, while mutations remain gated. |
| `godmode` | Maximum autonomous loop. High-risk effects such as memory writes, external sends, payment, and destructive actions remain gated. |

## Agent roster

| Agent | Role | Mission |
| --- | --- | --- |
| Hana | User-facing governor | Own the goal and final synthesis. |
| Kannon | Planner | Decompose goals and maintain the execution graph. |
| Librarian | Researcher | Collect, verify, and cite evidence. |
| Hephaestus | Coder | Read, modify, and validate code when permission allows. |
| Seiji | Operator | Operate tools, files, desktop surfaces, and external integrations. |
| Miroku | Reviewer | Review risk, correctness, privacy, and side effects. |
| Archivist | Archivist | Persist audit trails, session summaries, and memory candidates. |

## Current scope

This PR establishes the transport, data model, permission profile, deterministic intent routing, agent selection, execution graph, and persistent audit log. It intentionally does not yet wire real tool execution, memory writes, PR creation, or background continuation.

The audit store is persisted at:

```txt
$HANA_HOME/ultrawork/runs.json
```

## Next PRs

1. Add confirmation endpoints and continue/cancel actions.
2. Bind Ultrawork steps to the existing activity hub so Desktop can render live status.
3. Wire `utility:call-text` for planner/reviewer synthesis.
4. Add real delegated work packets for coding, research, product, and personal ops.
5. Add permission-gated file mutation and PR creation.
