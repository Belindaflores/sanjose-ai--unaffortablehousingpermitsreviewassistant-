---
name: Development database connection resets
description: Administrative development-database resets can interrupt an otherwise healthy running API.
---

An idle development database connection may be terminated with PostgreSQL `57P01` while the frontend remains running. This indicates administrative connection termination, not bad credentials or a missing schema.

**Why:** A preview outage was caused by a database interruption terminating the API process, while Vite continued serving the frontend. The database was reachable again without credential or schema changes.

**How to apply:** When preview is blank or stuck loading permissions, distinguish API process failure from frontend availability. Treat administrative connection termination as a recoverable interruption; do not rotate secrets or migrate schemas merely because an existing connection was reset.