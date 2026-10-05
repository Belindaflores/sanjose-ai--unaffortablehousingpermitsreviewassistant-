---
name: Date-only API boundaries
description: Generated date coercion can change date-only JSON values into ISO timestamps.
---

Normalize date-only fields after generated response validation, and make UI date formatting tolerate both YYYY-MM-DD and ISO timestamp strings without shifting the intended calendar date.

**Why:** Generated Zod validators coerce OpenAPI date fields into JavaScript Date objects. JSON serialization then emits a timestamp even when the database contains a date-only string. A UI parser that split the value into numeric year/month/day crashed on the timestamp suffix.

**How to apply:** Check actual JSON wire values, not just database values or TypeScript interfaces. Restore YYYY-MM-DD for fields contracted as date-only, and use a UTC calendar-date display where the date should not vary with the browser timezone.