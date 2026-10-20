---
name: GitHub source-control authorization
description: Source-control connection metadata and generic integration forms can disagree with actual Git CLI authorization.
---

Treat a successful authenticated Git operation as the evidence that GitHub access works. Do not assume that active or healthy source-control connection metadata repairs a rejected Git credential.

**Why:** The source-control connection reported active and healthy while Git fetch rejected authentication. Generic reconnect and connect forms could not open for that connection, reporting that a connector identifier was required.

**How to apply:** If those forms reject the source-control connection, stop retrying them and use the official Replit Connected Services reconnect flow. Keep credentials out of chat and logs, and leave Git histories unchanged until access is restored. Do not force-push to work around authentication or unrelated histories.
