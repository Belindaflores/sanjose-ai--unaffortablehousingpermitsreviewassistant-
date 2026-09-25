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
- Rule-based AI screening remains client-side and explainable. The database stores both the applicant input and generated screening output.
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

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
