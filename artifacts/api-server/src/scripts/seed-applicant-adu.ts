import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { getTableColumns, inArray, sql } from "drizzle-orm";
import { db, pool, portalUsersTable, countyPublicRecordsTable, permitApplicationsTable } from "@workspace/db";
import { APPLICANT_ADU_IDS, buildApplicantAdu, validateAduSources } from "../lib/applicant-adu-seed";
import { readRuleConfig, toValues } from "../lib/permit-screening";

const args = process.argv.slice(2);
const email = args[args.indexOf("--owner-email") + 1];
const sqlPath = args.includes("--production-sql") ? args[args.indexOf("--production-sql") + 1] : undefined;
const apply = args.includes("--apply");

// SQL is an operator-run data seed, not a migration or a server startup hook.
const quote = (value: string) => `E'${value.replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
function databaseJson(table: typeof permitApplicationsTable | typeof countyPublicRecordsTable, values: object) {
  const columns = getTableColumns(table);
  const data = values as Record<string, unknown>;
  return JSON.stringify(Object.fromEntries(Object.entries(columns)
    .filter(([key]) => data[key] !== undefined)
    .map(([key, column]) => [column.name, data[key]])));
}

async function main() {
  if (!args.includes("--owner-email") || !email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ||
      (args.includes("--production-sql") && (!sqlPath || sqlPath.startsWith("--")))) {
    throw new Error("Usage: seed-applicant-adu.ts --owner-email <portal email> [--apply] [--production-sql <output.sql>]. Without --apply, no database writes occur.");
  }
  const config = await readRuleConfig();
  const sources = validateAduSources(await db.select().from(countyPublicRecordsTable)
    .where(inArray(countyPublicRecordsTable.sourceRecordId, [...APPLICANT_ADU_IDS])));

  if (sqlPath) {
    const commands = sources.map(source => {
      const sourceJson = databaseJson(countyPublicRecordsTable, source);
      const template = toValues(buildApplicantAdu(source, { id: "OWNER_PLACEHOLDER", email }, config));
      const applicationJson = databaseJson(permitApplicationsTable, template);
      // Production resolves its own account ID. Never reuse a development Clerk ID.
      const sourceId = quote(source.sourceRecordId);
      return `
  INSERT INTO county_public_records
    SELECT * FROM jsonb_populate_record(NULL::county_public_records, ${quote(sourceJson)}::jsonb)
    ON CONFLICT (source_record_id) DO NOTHING;
  IF NOT EXISTS (
    SELECT 1 FROM county_public_records
    WHERE source_record_id = ${sourceId}
      AND business_name = ${quote(source.businessName!)}
      AND site_location = ${quote(source.siteLocation!)}
      AND housing_details->>'officialApplicant' = ${quote(source.housingDetails!.officialApplicant!)}
      AND housing_details->>'projectType' = ${quote(source.housingDetails!.projectType)}
      AND housing_details->>'workDescription' = ${quote(source.housingDetails!.workDescription)}
      AND (housing_details->>'dwellingUnits')::integer = 1
  ) THEN RAISE EXCEPTION 'ADU source differs from validated permit; no applications inserted'; END IF;
  v_id := 'SCC-' || (md5(v_owner.id || ':' || ${sourceId})::uuid)::text;
  IF EXISTS (SELECT 1 FROM permit_applications WHERE id = v_id AND owner_user_id IS DISTINCT FROM v_owner.id)
    THEN RAISE EXCEPTION 'Application ID ownership conflict'; END IF;
  INSERT INTO permit_applications
    SELECT * FROM jsonb_populate_record(NULL::permit_applications,
      ${quote(applicationJson)}::jsonb || jsonb_build_object(
        'id', v_id, 'owner_user_id', v_owner.id, 'email', v_owner.email,
        'created_at', CURRENT_TIMESTAMP, 'updated_at', CURRENT_TIMESTAMP,
        'submitted_at', CURRENT_TIMESTAMP,
        'timeline', jsonb_build_array(
          jsonb_build_object('label','Application submitted','status','completed','date',CURRENT_TIMESTAMP,'detail','Recorded stage'),
          jsonb_build_object('label','County intake','status','current','date',CURRENT_TIMESTAMP,'detail','In County Intake'),
          jsonb_build_object('label','Planning review','status','upcoming','date','','detail','Pending authorized staff review'),
          jsonb_build_object('label','Building review','status','upcoming','date','','detail','Pending authorized staff review'),
          jsonb_build_object('label','Final County decision','status','upcoming','date','','detail','Pending authorized staff review')
        )))
    ON CONFLICT (id) DO NOTHING;`;
    }).join("\n");
    let tagIndex = 0;
    let tag = "$adu_seed$";
    while (commands.includes(tag) || email.includes(tag)) tag = `$adu_seed_${++tagIndex}$`;
    const requiredColumns = Object.values(getTableColumns(permitApplicationsTable)).map(column => quote(column.name)).join(", ");
    const output = `-- Operator-run production data seed. No schema changes. Existing records are never overwritten.
-- Sign in to the published portal using this email first. Run the WHOLE transaction in production's SQL runner.
BEGIN;
DO ${tag}
DECLARE v_owner portal_users%ROWTYPE; v_id text; v_count integer;
BEGIN
  IF EXISTS (
    SELECT unnest(ARRAY[${requiredColumns}]) EXCEPT
    SELECT column_name::text FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'permit_applications'
  ) THEN RAISE EXCEPTION 'Publish the current schema before seeding. No data was changed.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('applicant-adu-seed'), hashtext(${quote(email.toLowerCase())}));
  SELECT count(*) INTO v_count FROM portal_users WHERE lower(email) = lower(${quote(email)});
  IF v_count <> 1 THEN RAISE EXCEPTION 'Exactly one portal profile must exist for the requested email. Sign in first; nothing was seeded.'; END IF;
  SELECT * INTO STRICT v_owner FROM portal_users WHERE lower(email) = lower(${quote(email)});
${commands}
END ${tag};
COMMIT;
SELECT id, project_name, review_status, owner_user_id FROM permit_applications
WHERE owner_user_id = (SELECT id FROM portal_users WHERE lower(email) = lower(${quote(email)}))
  AND id IN (${APPLICANT_ADU_IDS.map(id => `'SCC-' || (md5((SELECT id FROM portal_users WHERE lower(email) = lower(${quote(email)})) || ':' || ${quote(id)})::uuid)::text`).join(", ")});
`;
    await mkdir(dirname(sqlPath), { recursive: true });
    await writeFile(sqlPath, output, { mode: 0o600 });
    console.log(`Prepared operator-run production SQL: ${sqlPath}. Production has NOT been modified.`);
    if (!apply) return;
  }

  const result = await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('applicant-adu-seed'), hashtext(${email.toLowerCase()}))`);
    const owners = await tx.select().from(portalUsersTable).where(sql`lower(${portalUsersTable.email}) = lower(${email})`);
    if (owners.length !== 1) throw new Error("Exactly one saved portal profile must match this email. Sign in to this environment first. No applications were inserted.");
    const owner = owners[0]!;
    const applications = sources.map(source => toValues(buildApplicantAdu(source, owner, config)));
    const existing = await tx.select().from(permitApplicationsTable)
      .where(inArray(permitApplicationsTable.id, applications.map(application => application.id)));
    if (existing.some(application => application.ownerUserId !== owner.id)) throw new Error("Application ID ownership conflict.");
    if (!apply) return { mode: "dry-run", planned: applications.map(a => ({ id: a.id, projectName: a.projectName })), alreadyPresent: existing.length };
    const inserted = await tx.insert(permitApplicationsTable).values(applications)
      .onConflictDoNothing({ target: permitApplicationsTable.id }).returning({ id: permitApplicationsTable.id, projectName: permitApplicationsTable.projectName });
    return { mode: "applied", inserted, alreadyPresent: applications.length - inserted.length };
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : "ADU seeding failed.");
  process.exitCode = 1;
}).finally(() => pool.end());