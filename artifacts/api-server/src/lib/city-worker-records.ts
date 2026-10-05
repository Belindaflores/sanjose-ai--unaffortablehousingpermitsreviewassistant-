import { db, cityWorkerApplicationRecordsTable, type CityWorkerApplicationRecord } from "@workspace/db";
import { and, asc, eq, sql } from "drizzle-orm";
import { checkJurisdiction, GetPortalReviewRecordResponse, ListPortalReviewRecordsResponse, SAN_JOSE_ZIPS } from "@workspace/api-zod";

export const WORKSPACE_DATA_SOURCE_NOTE = "Records shown in this workspace use synthetic data modeled on public City housing and permit records. They are for system demonstration and workflow testing.";
// Reference population, NOT an application count. Workspace counts use DB rows only.
const officialCitySourceCount = 17_272;
const officialCitySourceUrl = "https://data.sanjoseca.gov/dataset/active-building-permits";

export function toPortalReviewRecord(row: CityWorkerApplicationRecord) {
  if (row.recordCategory === "City Housing Permits" &&
    (checkJurisdiction(row.address).status !== "In County" || !SAN_JOSE_ZIPS.has(row.zipCode) ||
    !/^San Jos[eé]$/.test(row.city) || !["CA", "California"].includes(row.state))) {
    throw new Error(`Database record ${row.id} failed San José jurisdiction validation.`);
  }
  return GetPortalReviewRecordResponse.parse({
    ...row,
    totalHousingUnits: row.totalUnits, affordableHousingUnits: row.affordableUnits,
    affordableHousing: row.affordableUnits > 0, reviewStatus: row.status,
    dataSource: "Synthetic",
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  });
}

export async function getCityWorkerWorkspace(workspaceId: string) {
  const rows = await db.select().from(cityWorkerApplicationRecordsTable)
    .where(eq(cityWorkerApplicationRecordsTable.workspaceId, workspaceId))
    .orderBy(sql`CASE ${cityWorkerApplicationRecordsTable.recordCategory} WHEN 'City Housing Permits' THEN 0 WHEN 'County Public Data' THEN 1 ELSE 2 END`,
      asc(cityWorkerApplicationRecordsTable.id));
  return ListPortalReviewRecordsResponse.parse({
    records: rows.map(toPortalReviewRecord),
    officialCitySourceCount, officialCitySourceUrl, notice: WORKSPACE_DATA_SOURCE_NOTE,
  });
}

export async function getCityWorkerRecord(workspaceId: string, id: string) {
  const [row] = await db.select().from(cityWorkerApplicationRecordsTable)
    .where(and(eq(cityWorkerApplicationRecordsTable.workspaceId, workspaceId), eq(cityWorkerApplicationRecordsTable.id, id)));
  return row ? toPortalReviewRecord(row) : null;
}