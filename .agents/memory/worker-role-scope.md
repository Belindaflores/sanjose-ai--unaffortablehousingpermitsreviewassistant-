---
name: Worker and applicant role scope
description: City Worker is an existing-application management view; its dashboard cap is display-only.
---

City Workers view/manage existing applications and must not see submission entry points or the creation form. Keep new-application functionality on the Permit Applicant side.

**Why:** On 2026-10-04 the user explicitly separated the two portal roles and required the applicant feature to remain unchanged.

**How to apply:** Review all worker entry points, not just the dashboard button, while preserving applicant navigation and submission behavior.

The City Worker dashboard Applications count is capped at 100 for display only; smaller totals show their actual value. Do not cap, truncate, delete, or modify underlying data to achieve that display.

**Why:** The user explicitly stated that all application data must remain intact and available for management.

**How to apply:** Cap only the dashboard metric. Keep full queue browsing, source datasets, data fetching, and unrelated review statistics unchanged.