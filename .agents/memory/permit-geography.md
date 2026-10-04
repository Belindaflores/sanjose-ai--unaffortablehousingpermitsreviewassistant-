---
name: Permit prototype geography
description: Why the prototype's county-wide address screen is not a legal permitting-jurisdiction determination.
---

The requested jurisdiction safeguard intentionally includes incorporated Santa Clara County cities as well as unincorporated areas. Treat this as a prototype geography screen, not a statement that the County permitting office has legal authority over every project in those cities.

**Why:** The red-team fix explicitly requested the county-wide city and ZIP allowlists. Changing this to an unincorporated-only boundary would reject addresses the user expects to accept.

**How to apply:** Preserve the requested geographic boundary and the prototype disclaimers. Any future official-jurisdiction determination needs a separate, explicit product decision about city versus County permitting authority.