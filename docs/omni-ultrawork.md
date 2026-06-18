# Omni Ultrawork MVP

Omni Ultrawork is the Svananda counterpart to an agent-harness `ultrawork` mode: one user goal enters the system, then Hana routes intent, selects specialist agents, applies a permission profile, creates a resumable execution graph, generates plan/review artifacts, broadcasts activity, and persists an audit trail.

## CLI

```bash
hana ultrawork "ship the first Omni Ultrawork MVP" --auto
hana ultrawork "audit my repo and propose the next PR" --safe
hana ultrawork "finish the whole feature with tests" --godmode --json

hana ultrawork list
hana ultrawork show <run-id>
hana ultrawork confirm <run-id> --reason "approved plan"
hana ultrawork continue <run-id>
hana ultrawork cancel <run-id> --reason "wrong scope"
```

## API

```txt
GET  /api/ultrawork/capabilities
GET  /api/ultrawork/runs?limit=20
GET  /api/ultrawork/runs/:id
POST /api/ultrawork/runs
POST /api/ultrawork/runs/:id/confirm
POST /api/ultrawork/runs/:id/continue
POST /api/ultrawork/runs/:id/cancel
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

Action body:

```json
{
  "actor": "cli",
  "reason": "approved plan"
}
```

## Modes

| Mode | Meaning |
| --- | --- |
| `safe` | Plan-first mode. It creates the run and waits for confirmation before autonomous execution. |
| `auto` | Default mode. It can route, plan, delegate, search, and draft, while mutations remain gated. |
| `godmode` | Maximum autonomous loop. High-risk effects such as memory writes, external sends, payment, and destructive actions remain gated. |

## Lifecycle

| Action | Meaning |
| --- | --- |
| `start` | Creates a run, intent route, agent roster, permission profile, step graph, artifacts, and audit trail. |
| `confirm` | Confirms a waiting safe-mode run and advances the skeleton execution graph. |
| `continue` | Advances a queued or running run. Waiting safe-mode runs remain blocked until confirmation. |
| `cancel` | Cancels non-completed runs and marks unfinished steps as cancelled. |
| `show` | Reads one persisted run. |
| `list` | Lists recent persisted runs. |

## Artifacts

Each run can include generated artifacts. The initial MVP creates two artifacts at run creation:

| Artifact | Agent | Source |
| --- | --- | --- |
| `plan` | Kannon / planner | Utility model when available, deterministic fallback otherwise. |
| `review` | Miroku / reviewer | Utility model when available, deterministic fallback otherwise. |

Artifacts are persisted inside the run record and shown by `hana ultrawork show <run-id>`. They intentionally do not claim that tools were executed.

## ActivityHub mapping

Ultrawork publishes activity into the existing ActivityHub contract instead of adding a separate desktop protocol.

| Ultrawork object | Activity kind | Notes |
| --- | --- | --- |
| Run | `workflow` | Parent task: `ultrawork:<run-id>`. |
| Agent role | `workflow_agent` | Child entries under the run, one per selected agent. |
| Step | `workflow_step` | Child entries under the run, one per execution-graph step. |

Status mapping:

| Ultrawork status | ActivityHub status |
| --- | --- |
| `queued`, `running`, `waiting_confirmation` | `running` |
| `completed` | `done` |
| `failed` | `failed` |
| `cancelled` | `aborted` |

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

This PR establishes the transport, data model, permission profile, deterministic intent routing, agent selection, execution graph, generated plan/review artifacts, persistent audit log, explicit run lifecycle actions, and ActivityHub publication. It intentionally does not yet wire real tool execution, memory writes, PR creation, or background continuation.

The audit store is persisted at:

```txt
$HANA_HOME/ultrawork/runs.json
```

ActivityHub persistence follows the existing workflow activity store:

```txt
$HANA_HOME/workflow-activity.json
```

## Next PRs

1. Add a Desktop Ultrawork panel/card backed by the existing `agent_activity` stream.
2. Add real delegated work packets for coding, research, product, and personal ops.
3. Add permission-gated file mutation and PR creation.
4. Add background continuation with explicit scheduler bounds.
5. Add artifact export into session files.
