---
name: Drizzle schema changes
description: Schema-push behavior in this workspace when existing database objects do not match the declared schema.
---

`drizzle-kit push` can stop at an interactive table-name conflict prompt in non-interactive runs. Do not use the force option until the proposed changes have been reviewed for data loss. For additive runtime state, prefer an explicit idempotent creation step when that fits the application's deployment model.

**Why:** A development schema push encountered a conflict prompt and could not continue in the workspace's non-TTY command runner.

**How to apply:** Before schema pushes, inspect the proposed database diff and choose an interactive migration/push path or a safe, narrowly scoped additive setup.
