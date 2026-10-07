---
name: Passcode access scope
description: The shared classroom passcode guards the entire prototype; both portals now open without individual email authentication.
---

Require exactly four numeric digits from the server-only APP_PASSCODE secret before exposing any permit portal pages, app files, sample documents, or data APIs. After unlocking, users choose either prototype role directly, without email authentication.

**Why:** The user said the professor requires a four-digit passcode and explicitly requested server enforcement. The user subsequently confirmed passcode-only access for both roles after being told that anyone with the passcode could choose City Worker and access staff records and actions. This supersedes the earlier requirement to retain individual account authentication.

**How to apply:** Preserve server guarding for the web service in both preview and production, not just API middleware. Do not switch production back to public static serving or inject the passcode into browser bundles. Use browser-session cookies rather than localStorage; keep secrets out of logs and test outputs. Retain throttling and enforce the selected role on the server. Applicant and worker are shared prototype presentations, not verified individual identities. Keep existing records and account-owned presentation data intact; do not interpret this change as permission to delete or reassign them.
