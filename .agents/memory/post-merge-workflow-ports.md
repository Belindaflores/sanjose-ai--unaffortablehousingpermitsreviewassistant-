---
name: Post-merge workflow ports
description: A failed artifact workflow restart may coexist with an older server still serving its port.
---

A managed workflow marked failed after a task merge can coexist with an older process still bound to the same port; a working preview alone does not mean the managed workflow is healthy.

**Why:** A restart failed with an occupied port while earlier frontend and API processes continued serving requests.

**How to apply:** Inspect workflow state and the process listening on the configured port before retrying. Stop only the stale listener, then restart the existing managed artifact workflow.

Checkpoint restores can also leave running services on the pre-restore version, even when the workflow reports running. Compiled API queries and the frontend's module cache may therefore disagree with the restored source and database.

**Why:** A restore left the API requesting removed schema fields and the browser referencing removed pages; the signed-in profile failed even though the current source's database query worked.

**How to apply:** After a restore, rebuild/restart the existing API and web workflows before treating stale runtime queries as a reason to modify the database.