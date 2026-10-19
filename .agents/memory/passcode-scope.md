---
name: Passcode access scope
description: The shared classroom passcode guards the entire prototype; both portals now open without individual email authentication.
---

Require exactly four numeric digits from the server-only APP_PASSCODE secret before exposing any permit portal pages, app files, sample documents, or data APIs. After unlocking, users choose either prototype role directly, without email authentication.

**Why:** The user said the professor requires a four-digit passcode and explicitly requested server enforcement. The user subsequently confirmed passcode-only access for both roles after being told that anyone with the passcode could choose City Worker and access staff records and actions. This supersedes the earlier requirement to retain individual account authentication.

**How to apply:** Preserve server guarding for the web service in both preview and production, not just API middleware. Do not switch production back to public static serving or inject the passcode into browser bundles. Use browser-session cookies rather than localStorage; keep secrets out of logs and test outputs. Retain throttling and enforce the selected role on the server. Applicant and worker are shared prototype presentations, not verified individual identities. Keep existing records and account-owned presentation data intact; do not interpret this change as permission to delete or reassign them.

Applicant entry collects a self-reported name and email for the browser session. Use those details in the applicant UI and new submissions, but do not describe them as verified login credentials or as a private account.

**Why:** The user reported that the applicant portal displayed another person's saved presentation name and asked that applicants enter their own name and email instead.

**How to apply:** Require the details when opening the applicant portal, keep them session-scoped, and keep pre-existing demo records separate from the entered identity. Individual verification requires a separate authentication decision.
