# Santa Clara Permit Review Assistant

A student prototype for AI-assisted permit intake, database-backed application records, and human County review workflows.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/permit-review-assistant run dev` — run the web app through its managed workflow
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- Web app: `artifacts/permit-review-assistant`
- API routes: `artifacts/api-server/src/routes`
- API contract: `lib/api-spec/openapi.yaml`
- Database schema: `lib/db/src/schema`

## Architecture decisions

- Seeded classroom demo records remain browser-local; applications submitted through the intake form are also saved to PostgreSQL and appear on Application Records.
- Screening rules are shared by the UI and server, but only the server's recalculated result is authoritative. Never trust caller-provided priority, verification, screening flags, ownership, or review histories.
- Real sign-in uses managed Clerk with cookie-based API authentication. New accounts are applicants; staff roles are assigned administratively, not through the portal chooser.
- Permit ownership is by authenticated user ID, not an email filter. Legacy records without an owner remain staff-only.
- Document contents are persisted privately in App Storage. A document marked received requires a completed, owned upload.
- Final approval remains an explicit staff action; AI never approves or denies a permit.

## Product

- Applicant permit intake with document completeness checks and rule-based pre-screening
- County staff dashboard, filters, review details, routing, notes, and human decisions
- Persistent Application Records page, newest first
- Workload analytics and classroom demo reset for local seed data

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Re-run API code generation after every OpenAPI change.
- Demo reset does not delete persistent Application Records.
- Unit regression checks: `pnpm --filter @workspace/api-server test`.
- To provision a staff account after it signs in, run `pnpm --filter @workspace/api-server exec tsx src/scripts/set-portal-role.ts <Clerk user ID> worker` from an authorized administrative shell. Use `fire_marshal` for Fire Marshal staff or `applicant` to revoke staff access. The worker-access screen shows the current account ID.
- Missing fire/life-safety plans for 20+ residential units (and applicable multifamily projects) trigger `On Hold - Safety Review Required`; the required Fire Marshal routing is first. Only `fire_marshal` staff may record a reasoned override. Owners can upload the missing plan from their saved detail page; the server validates storage ownership. An override never counts a missing plan as complete.
- At API startup, insert only the two curated public City housing examples if missing (`2024-089733-RS`, `2024-089749-RS`). Both must explicitly name the same official applicant in the City's APPLICANT field; missing or mismatched names hide the pair. Never infer applicants from owners/contractors or assign public permits to portal accounts. Never overwrite existing imports or copy private preview submissions/accounts into production. This is public application-data seeding, not a schema migration. These imports are retained independently of applicant-page presentation; source statuses are snapshots, not live City status.
- Saved private applications can be permanently deleted through their detail page by their authenticated owner or authorized staff only. Require confirmation of the exact application ID and enforce ownership server-side. A single shared-record deletion removes it from both portal views; never delete public examples, accounts, or stored uploaded files as part of this action. Clear affected list caches and keep other sessions refreshed. No production cleanup scripts or startup-time private-record deletion.
- Underserved area configuration is editable by staff under Help & guidance. Initial values are clearly labelled placeholders and never automatically verify claims.
- Applicant home, Applications, and Records must show only the signed-in applicant's own content. Do not render CountyPermitExamples on these pages. The public-source imports and City-side views remain intact; do not change fire/life-safety, priority verification, classification, or deletion features as part of removing the showcase.
- Explicitly requested ADU copies may be created as normal private applications for a verified existing portal profile via the operator-run `artifacts/api-server/src/scripts/seed-applicant-adu.ts`. See `artifacts/api-server/ADU_SEED.md`. Never fabricate owner IDs, uploaded files, priority verification, or finalized review history. No private application seeding on startup or login; production data writes are operator-run.
- To import/refresh the two housing examples from the official City API: `pnpm --filter @workspace/api-server exec tsx src/scripts/import-housing-showcase.ts`. The import rejects non-housing records and preserves the original source dates and unit counts.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
