---
name: Post-merge workflow ports
description: A failed artifact workflow restart may coexist with an older server still serving its port.
---

A managed workflow marked failed after a task merge can coexist with an older process still bound to the same port; a working preview alone does not mean the managed workflow is healthy.

**Why:** A restart failed with an occupied port while earlier frontend and API processes continued serving requests.

**How to apply:** Inspect workflow state and the process listening on the configured port before retrying. Stop only the stale listener, then restart the existing managed artifact workflow.