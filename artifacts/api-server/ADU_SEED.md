# Saved ADU application seed

This creates two ordinary private `permit_applications` records from permits
`2024-089733-RS` and `2024-089749-RS`. It does not mount a separate section or
change authentication, roles, safety screening, priority verification, or
classification.

## Preconditions

- The intended owner must sign in to the portal in each environment first.
  Development and production accounts are independent.
- Exactly one existing `portal_users` profile must match the supplied email.
  The script never creates accounts, fabricates Clerk IDs, or assigns roles.
- Both stored source permits must identify the same official applicant and
  each must describe a one-unit ADU at an in-County address.
- Records use the source project name, address, type, work description, units,
  valuation and official applicant. Contact email and ownership come from the
  portal profile. This does not assert that the account is the official builder.

## Development

Run from the workspace root:

```sh
pnpm --filter @workspace/api-server exec tsx src/scripts/seed-applicant-adu.ts \
  --owner-email "<portal-sign-in-email>" --apply
```

Without `--apply`, the command checks the proposed records without inserting
them. Account lookup failures stop before any application insert.

Identifiers depend on owner ID and original permit ID, not execution date.
Reruns insert no duplicates and never reset existing documents, status, notes,
or other edits. Both records start in **In County Intake**, an existing supported
review status. Creation and intake dates are current; later review and final
decision stages remain upcoming. All checklist items are **Not received**,
without filenames or stored-file paths.

## Production

Agent's production database access is read-only. The operator must perform the
production data write; republishing does not synchronize an existing production
database's rows with development.

Generate SQL using the validated development source records:

```sh
pnpm --filter @workspace/api-server exec tsx src/scripts/seed-applicant-adu.ts \
  --owner-email "<portal-sign-in-email>" \
  --production-sql ../../.local/exports/seed-applicant-adu.sql
```

This only exports SQL; it does not seed either database. The generated file
contains the requested account email, so it is kept in ignored local exports,
not in tracked source code.

1. Sign in to the published portal with the intended email.
2. Publish first if production's application schema is older. Publishing is a
   user action; the seed performs no schema migrations.
3. Open the **production** database in the Database tool and paste the entire
   generated SQL into its SQL runner. Run the complete transaction together.
4. Confirm the final query returns two records with the intended owner.
5. Reload Applicant home, Applications, and Records.

Production resolves its own portal user ID; it never reuses a development ID.
If source rows are absent there, it inserts the two validated source records
first. Existing source rows must match the validated fields and are never
overwritten. A missing owner, schema mismatch, or conflicting source aborts the
transaction. The production transaction can be rerun without duplicates.

## Files and tables

Application code:
- `src/lib/applicant-adu-seed.ts`: validated source-to-application builder.
- `src/scripts/seed-applicant-adu.ts`: development seeder and production SQL export.
- `src/tests/applicant-adu-seed.test.ts`: deterministic IDs, ownership, source
  validation, honest documents, normal status and timeline tests.
- `../permit-review-assistant/src/DeleteApplication.tsx`: removed unrelated
  public-example wording from the confirmation text; deletion behavior unchanged.
- `../permit-review-assistant/src/App.tsx`: normal staff review wording without
  references to demo records; review actions unchanged.
- `ADU_SEED.md`, workspace `replit.md`, and agent scope notes document the
  owner-bound import rule and the operator-run production requirement.

Data targets:
- `permit_applications`: the two new owner-bound applications.
- `county_public_records`: read-only in the development seed; production SQL
  inserts only the two missing source records, if needed.
- `portal_users`: lookup only, never modified.

No table definitions, OpenAPI contracts, authentication settings, or file
storage objects are changed.