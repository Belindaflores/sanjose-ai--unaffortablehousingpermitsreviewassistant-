---
name: Historical preview errors after code generation
description: Distinguish intermediate-build browser errors from current failures before changing generated client exports.
---

When a tester reports a missing generated API export after successful code generation and restart, check the error's age and the live served modules before changing the export structure.

**Why:** A tester retained an intermediate-build browser error and treated it as current even though the client barrel correctly re-exported the regenerated hook. A fresh, cache-disabled browser context confirmed the application and authenticated flow worked without code changes.

**How to apply:** Regenerate contracts before adding callers of new hooks. Compare reported errors with the current served exports, then cold-load the blocked flow when needed. Do not alter working barrels or authentication settings to compensate for historical logs.