---
name: Local PostgreSQL tests
description: Starting disposable PostgreSQL instances inside this workspace for integration tests.
---

When starting a temporary PostgreSQL server, pass a writable Unix-socket directory with `-k <temp-dir>`; the default `/run/postgresql` directory may be absent.

**Why:** `initdb` can succeed while `pg_ctl` fails because the workspace does not have PostgreSQL's default socket directory.

**How to apply:** For disposable test clusters, place the socket inside the temporary cluster directory and choose an explicit TCP port.
