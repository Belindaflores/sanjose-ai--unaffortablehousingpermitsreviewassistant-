---
name: Workspace test dependencies
description: Package installation behavior for dev dependencies in the pnpm workspace
---

The language-package installer can reject adding a dependency at the pnpm workspace root, while its package-token validation can also reject pnpm's `--filter` option. When this happens, install the dev dependency with pnpm explicitly scoped to the intended workspace package rather than relaxing the workspace root guard.

**Why:** The API test-runner installation needed a workspace-scoped dependency, and neither root installation nor passing a filter through the installer succeeded.

**How to apply:** Only use the explicit scoped pnpm command if the package installer cannot target the intended package; retain the package-specific dependency and lockfile update.