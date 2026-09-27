# Permit account access

All new Clerk accounts are applicants. The server obtains the account ID from a verified Clerk session and checks the account's server-managed `publicMetadata.role` on every API request. Only `worker` grants the staff portal and review permissions. The browser cannot select its own role.

To grant or revoke worker access, a trusted workspace operator must identify the intended Clerk user ID and run from `artifacts/api-server`:

```
node scripts/set-worker-role.mjs <clerk-user-id> worker
node scripts/set-worker-role.mjs <clerk-user-id> applicant
```

Do not publish an endpoint for this script or put a Clerk secret in frontend code. Confirm the person's employment/authorization out of band before granting worker access. Sign out and back in (or reload) after a role change.

Preexisting prototype records have no verified owner. They are intentionally invisible to applicants and visible only to workers; do not assign them to an applicant using an email address without independently verifying ownership.