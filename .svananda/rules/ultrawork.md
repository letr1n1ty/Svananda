# Ultrawork Rules

These rules define the first trust boundary for Svananda Omni Ultrawork.

## Autonomy modes

- `safe`: create a plan, then wait for confirmation before autonomous execution.
- `auto`: autonomous context loading, planning, delegation, search, drafting, and review are allowed. File mutation, memory write, external send, and PR creation require confirmation.
- `godmode`: autonomous looping, delegation, repair, verification, and synthesis are allowed. Memory write, external send, credential access, payment, and destructive actions require confirmation.

## Lifecycle actions

- `start`: create the run, route intent, select agents, apply permissions, generate the execution graph, generate delegated work packets, generate initial artifacts, and persist the first audit events.
- `confirm`: only meaningful for waiting safe-mode runs; confirmation turns the plan into an executable run.
- `run-next-packet`: run the next non-terminal work packet through the packet runner registry. It must not bypass safe-mode confirmation.
- `run-packet`: run one named work packet by id through the packet runner registry. It must not bypass safe-mode confirmation.
- `sync-artifacts`: re-run session-file export for artifacts that do not already have exported file metadata. It must not mutate artifact content or perform external effects.
- `continue`: advance a queued or running run. It must not bypass safe-mode confirmation.
- `cancel`: stop a non-completed run and mark unfinished steps and work packets as cancelled.
- `show` and `list`: read-only inspection only.

## Work packet runners

Packet runners are execution adapters for delegated work packets. In this MVP, packet runners must remain skeleton-safe unless explicitly replaced by a future permission-gated runner.

Skeleton-safe packet runners may:

- update packet status
- append audit events
- produce deterministic `note` artifacts
- request session-file artifact export when a session exists
- publish ActivityHub workflow state

Skeleton-safe packet runners must not:

- mutate repository files
- stage commits
- open or update pull requests
- send messages
- write long-term memory
- spend money
- access credentials
- claim that external tools were executed when they were not

## Mandatory reviewer

Every Ultrawork run must include a reviewer role. The reviewer checks:

- correctness
- privacy
- hidden side effects
- irreversible actions
- over-broad memory writes
- mismatch between goal and proposed action

## Audit trail

Every run must preserve:

- goal
- mode
- intent classification
- selected agents
- permission profile
- execution graph
- delegated work packets
- lifecycle action history
- packet runner results
- artifact export metadata
- review status
- generated artifacts or mutation candidates

## Artifact export

Artifacts are run records first. Session-file export is an attachment mechanism, not the source of truth.

Artifact sync may create managed markdown files for artifacts that do not already have exported file metadata. It must not rewrite existing exported artifact records unless a future migration explicitly says so.

## External effects

External-world effects require explicit confirmation unless a future signed policy grants narrower permission.

External effects include:

- sending messages
- publishing content
- opening pull requests
- writing long-term memory
- deleting or overwriting files
- spending money
- changing credentials or security settings
