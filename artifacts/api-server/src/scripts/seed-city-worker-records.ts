import { db, pool, cityWorkerApplicationRecordsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { buildPortalReviewRecords } from "../lib/portal-review-records";

// Explicit, additive data seed. No runtime seeding, schema changes, deletions,
// or overwrites of edited records. Never call this from server startup.
async function seedCityWorkerRecords() {
  const values = buildPortalReviewRecords().map(r => ({
    id: r.id, permitNumber: r.permitNumber, projectName: r.projectName,
    address: r.address, city: r.city, state: r.state, zipCode: r.zipCode,
    applicationType: r.applicationType, totalUnits: r.totalHousingUnits,
    affordableUnits: r.affordableHousingUnits, housingCategory: r.housingCategory,
    status: r.reviewStatus, priority: r.priority, department: r.department,
    sourceType: r.sourceType, isSynthetic: r.isSynthetic,
    recordCategory: r.recordCategory, housingType: r.housingType, workType: r.workType,
    sourceStatus: r.sourceStatus, issuedDate: r.issuedDate, finalDate: r.finalDate,
    submittedDate: r.submittedDate, description: r.description, sourceUrl: r.sourceUrl,
  }));
  await db.transaction(async tx => {
    await tx.insert(cityWorkerApplicationRecordsTable).values(values).onConflictDoNothing({ target: cityWorkerApplicationRecordsTable.id });
  });
  const [count] = await db.select({ total: sql<number>`count(*)::int` }).from(cityWorkerApplicationRecordsTable);
  console.log(`city_worker_application_records: ${count!.total} database rows. Existing rows preserved.`);
}
seedCityWorkerRecords().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => pool.end());