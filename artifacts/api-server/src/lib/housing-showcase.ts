import { db, countyPublicRecordsTable } from "@workspace/db";
import { housingShowcaseRecords } from "../data/housing-showcase";

/**
 * Only insert missing curated public examples. This is ordinary application
 * data, not a schema migration or a development-to-production database copy.
 * One atomic insert and conflict protection make concurrent starts safe.
 * Existing imported data, private submissions, accounts and roles stay intact.
 */
export async function ensurePublicHousingExamples(database: Pick<typeof db, "insert"> = db) {
  const inserted = await database.insert(countyPublicRecordsTable)
    .values(housingShowcaseRecords)
    .onConflictDoNothing({ target: countyPublicRecordsTable.sourceRecordId })
    .returning({ id: countyPublicRecordsTable.sourceRecordId });
  return inserted.length;
}