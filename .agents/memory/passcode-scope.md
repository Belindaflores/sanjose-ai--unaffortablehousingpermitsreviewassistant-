---
name: Passcode access scope
description: The shared classroom passcode is an additional app-wide gate, not a replacement for account authorization.
---

Require exactly four numeric digits from the server-only APP_PASSCODE secret before exposing any permit portal pages, app files, sample documents, or data APIs. Keep existing Clerk identity and role restrictions after unlocking.

**Why:** The user said the professor requires a four-digit passcode, specifically requested server enforcement for all parts of the app, and asked that existing permit review functionality stay unchanged. A client-only overlay or public static frontend would leave direct file access unprotected.

**How to apply:** Preserve server guarding for the web service in both preview and production, not just API middleware. Do not switch production back to public static serving or inject the passcode into browser bundles. Use a browser-session cookie rather than localStorage; keep secrets out of logs and test outputs. Four digits provide only a shared access gate, so retain throttling and the existing per-account permissions.
