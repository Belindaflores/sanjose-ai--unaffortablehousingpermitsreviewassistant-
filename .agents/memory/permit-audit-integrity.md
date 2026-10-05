---
name: Permit audit integrity
description: Why permit review changes use revision-based concurrency instead of timestamp comparison.
---

Use revision-based concurrency checks for permit review mutations so simultaneous staff actions cannot silently overwrite each other's decisions or audit entries.

**Why:** PostgreSQL timestamps can have microsecond precision while JavaScript Date has millisecond precision. Timestamp equality is not a reliable compare-and-swap boundary for this audit history.

**How to apply:** Preserve concurrency checks when extending review actions. A stale edit must fail explicitly and require reloading, rather than losing an earlier staff decision.