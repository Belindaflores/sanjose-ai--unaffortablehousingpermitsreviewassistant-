---
name: Protected browser testing
description: Secret-dependent authentication in the browser tester must use the workspace runtime, not sandbox environment variables.
---

The browser-testing sandbox does not expose the workspace's `process.env`. Authenticate secret-dependent test flows in a standalone workspace process and pass private session state directly to the browser, without printing credentials or cookie contents.

**Why:** Attempting to use the existing passcode from the sandbox blocked the browser test even though the app and its configured secret were working.

**How to apply:** Keep the application's real authentication and credentials unchanged. If temporary browser session-state storage is needed, restrict its permissions and remove it after the browser loads it. Never inspect it with tools that display its contents.
