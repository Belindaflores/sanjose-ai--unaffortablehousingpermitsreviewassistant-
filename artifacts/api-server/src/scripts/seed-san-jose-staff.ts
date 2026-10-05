/** Explicit development dataset replacement. Archives staff visibility; never deletes owner data.
 * Idempotent: a rerun does not reset staff decisions on an existing synthetic fixture.
 */
import { db, pool, permitApplicationsTable } from "@workspace/db";
import { eq, and, notInArray, sql } from "drizzle-orm";
import { buildSanJoseStaffDataset } from "../lib/san-jose-staff-dataset";
import { toValues } from "../lib/permit-screening";

const workspaceId = process.argv[2];
if (!workspaceId) throw new Error("Pass an explicit authorized workspace ID.");
try {
  const fixtures = buildSanJoseStaffDataset(workspaceId);
  await db.transaction(async tx => {
    await tx.update(permitApplicationsTable).set({ staffVisible: false, revision: sql`${permitApplicationsTable.revision} + 1` })
      .where(and(eq(permitApplicationsTable.workspaceId, workspaceId), eq(permitApplicationsTable.staffVisible, true), notInArray(permitApplicationsTable.id, fixtures.map(a => a.id))));
    for (const fixture of fixtures) {
      await tx.insert(permitApplicationsTable).values({ ...toValues(fixture), dataSource: "Synthetic", housingCategory: fixture.housingCategory, staffVisible: true })
        .onConflictDoNothing({ target: permitApplicationsTable.id });
    }
    const active = await tx.select({ id: permitApplicationsTable.id }).from(permitApplicationsTable)
      .where(and(eq(permitApplicationsTable.workspaceId, workspaceId), eq(permitApplicationsTable.staffVisible, true)));
    if (active.length !== 10) throw new Error("Dataset setup did not produce exactly ten records; changes rolled back.");
  });
  console.log("Ten synthetic San José staff records provisioned; previous owner records retained outside the staff list.");
} finally { await pool.end(); }