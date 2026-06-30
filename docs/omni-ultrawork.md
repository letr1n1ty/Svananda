# Omni Ultrawork MVP

Omni Ultrawork is the Svananda counterpart to an agent-harness `ultrawork` mode: one user goal enters the system, then Hana routes intent, selects specialist agents, applies a permission profile, creates a resumable execution graph, generates delegated work packets, runs packets through a packet runner registry, generates plan/review/runner artifacts, exports artifacts to session files when a session exists, broadcasts activity, persists an audit trail, and exposes a read-only Desktop panel for capabilities and recent runs.

## CLI

```bash
hana ultrawork "ship the first Omni Ultrawork MVP" --auto
hana ultrawork "audit my repo and propose the next PR" --safe
hana ultrawork "finish the whole feature with tests" --godmode --json

hana ultrawork list
hana ultrawork show <run-id>
hana ultrawork confirm <run-id> --reason "approved plan"
hana ultrawork run-next-packet <run-id>
hana ultrawork run-packet <run-id> <packet-id>
hana ultrawork sync-artifacts <run-id>
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
POST /api/ultrawork/runs/:id/artifacts/sync
POST /api/ultrawork/runs/:id/packets/next/run
POST /api/ultrawork/runs/:id/packets/:packetId/run
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
| `start` | Creates a run, intent route, agent roster, permission profile, step graph, delegated work packets, artifacts, exported artifact session files when a session exists, and audit trail. |
| `confirm` | Confirms a waiting safe-mode run. It does not execute packets. |
| `run-next-packet` | Runs the first non-terminal packet through the packet runner registry. |
| `run-packet` | Runs one packet by id through the packet runner registry. |
| `sync-artifacts` | Re-runs session-file export for artifacts that do not already have exported file metadata. It is useful when a run was created before `sessionPath` or exporter wiring was available. |
| `continue` | Completes the skeleton run and all remaining packets. Waiting safe-mode runs remain blocked until confirmation. |
| `cancel` | Cancels non-completed runs and marks unfinished steps/work packets as cancelled. |
| `show` | Reads one persisted run. |
| `list` | Lists recent persisted runs. |

## Work packets

Work packets are structured handoff units between planning and real tool execution. They make delegation explicit so later PRs can bind packets to concrete tool runners.

| Packet kind | Agent | Purpose |
| --- | --- | --- |
| `coding` | Hephaestus / coder | File impact map, implementation checklist, test plan, mutation candidates. |
| `research` | Librarian / researcher | Source checklist, evidence summary, uncertainty log, citation requirements. |
| `product` | Librarian / researcher | Requirements outline, acceptance criteria, edge cases, open decisions. |
| `personal_ops` | Seiji / operator | Draft actions, integration checklist, privacy review inputs, confirmation requests. |
| `review` | Miroku / reviewer | Risk summary, blocked actions, safe-to-proceed recommendation, confirmation checklist. |
| `archive` | Archivist | Audit log, artifact references, resume summary, approved memory candidates. |

Each packet records objective, inputs, deliverables, confirmation gates, status, source, and owning agent. Packets are shown in `hana ultrawork show <run-id>` and listed in `hana ultrawork list` counts.

The MVP packet runner registry registers no-op runners for every packet kind. The coding packet additionally has a skeleton impact-map runner that returns a `note` artifact containing an implementation checklist, test plan, confirmation gates, and mutation status. These runners do not execute tools, mutate files, send messages, write memory, or open pull requests.

## Artifacts

Each run can include generated artifacts. The initial MVP creates two artifacts at run creation:

| Artifact | Agent | Source |
| --- | --- | --- |
| `plan` | Kannon / planner | Utility model when available, deterministic fallback otherwise. |
| `review` | Miroku / reviewer | Utility model when available, deterministic fallback otherwise. |
| `note` | Packet runner owner | Runner-produced notes such as the coding impact map. |

Artifacts are persisted inside the run record and shown by `hana ultrawork show <run-id>`. They intentionally do not claim that tools were executed.

When a run has `sessionPath`, each artifact is also materialized as a managed markdown session file:

```txt
$HANA_HOME/session-files/<session-hash>/ultrawork/<run-id>/<artifact-kind>-<artifact-title>.md
```

The file is registered through the existing session file registry with `origin=agent_artifact`, `operation=created`, `storageKind=managed_cache`, and a stable `ultrawork-artifact` source key.

`hana ultrawork sync-artifacts <run-id>` and `POST /api/ultrawork/runs/:id/artifacts/sync` re-run export only for artifacts without exported file metadata. Existing exported artifact records are left unchanged.

## ActivityHub mapping

Ultrawork publishes activity into the existing ActivityHub contract instead of adding a separate desktop protocol. The runtime reads ActivityHub lazily through a getter so workflow events still publish if the hub is attached after command-route construction.

| Ultrawork object | Activity kind | Notes |
| --- | --- | --- |
| Run | `workflow` | Parent task: `ultrawork:<run-id>`. |
| Agent role | `workflow_agent` | Child entries under the run, one per selected agent. |
| Step | `workflow_step` | Child entries under the run, one per execution-graph step. |
| Work packet | `workflow_step` | Child entries under the run with `stepKind=work_packet`. |

Status mapping:

| Ultrawork status | ActivityHub status |
| --- | --- |
| `queued`, `running`, `waiting_confirmation` | `running` |
| `completed` | `done` |
| `failed` | `failed` |
| `cancelled` | `aborted` |

## Desktop panel

The Desktop surface is intentionally read-only in this MVP. The sidebar exposes an `Ultrawork` entry that opens a floating panel next to Activity, Automation, and Bridge.

The panel reads:

- `GET /api/ultrawork/capabilities`
- `GET /api/ultrawork/runs?limit=12`

It displays runtime capability counts, packet runner counts, artifact/text-generation flags, recent run status, mode, intent, packet completion ratio, and exported artifact ratio. It does not start runs, execute packets, sync artifacts, or perform any external effect.

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

This PR establishes the transport, data model, permission profile, deterministic intent routing, agent selection, execution graph, delegated work packets, packet runner registry, generated plan/review/runner artifacts, exported artifact session files, manual artifact sync, persistent audit log, explicit run lifecycle actions, ActivityHub publication, and a read-only Desktop panel. It intentionally does not yet wire real tool execution, memory writes, PR creation, UI mutation controls, or background continuation.

The audit store is persisted at:

```txt
$HANA_HOME/ultrawork/runs.json
```

ActivityHub persistence follows the existing workflow activity store:

```txt
$HANA_HOME/workflow-activity.json
```

## Review notes

- The runtime file was formatted after an earlier compressed implementation pass; the large runtime diff is not intended to introduce a separate feature boundary.
- Server routes normalize unknown thrown values before logging or returning errors.
- The Desktop panel is read-only and deliberately avoids start/run/sync buttons in this MVP.
- No local test or typecheck command has been run as part of this connector-only implementation pass.

## Next PRs

1. Bind work packets to real tool runners for coding, research, product, and personal ops.
2. Add permission-gated file mutation and PR creation.
3. Add background continuation with explicit scheduler bounds.
4. Add artifact regeneration actions.
5. Add safe UI controls for packet execution and artifact sync.
