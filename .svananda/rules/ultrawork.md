# Ultrawork Rules

These rules define the first trust boundary for Svananda Omni Ultrawork.

## Autonomy modes

- `safe`: create a plan, then wait for confirmation before autonomous execution.
- `auto`: autonomous context loading, planning, delegation, search, drafting, and review are allowed. File mutation, memory write, external send, and PR creation require confirmation.
- `godmode`: autonomous looping, delegation, repair, verification, and synthesis are allowed. Memory write, external send, credential access, payment, and destructive actions require confirmation.

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
- review status
- generated artifacts or mutation candidates

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
