// Import only verified public residential permits, never private applicant data.
import { db, pool, countyPublicRecordsTable } from "@workspace/db";

const resourceId = "761b7ae8-3be1-4ad6-923d-c7af6404a904";
const permitNumbers = ["2023-081161-MF", "2024-111170-RS"];
const sourceUrl = "https://data.sanjoseca.gov/dataset/active-building-permits";
const fields = ["FOLDERNUMBER", "FOLDERNAME", "FOLDERDESC", "SUBTYPEDESCRIPTION", "WORKDESCRIPTION", "gx_location", "Status", "ISSUEDATE", "FINALDATE", "DWELLINGUNITS", "PERMITVALUATION"];

function sourceDate(value: string | null) {
  if (!value) return null;
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?: |$)/.exec(value);
  if (!match) throw new Error("Unexpected City permit date format.");
  const iso = `${match[3]}-${match[1]!.padStart(2, "0")}-${match[2]!.padStart(2, "0")}`;
  if (Number.isNaN(Date.parse(iso)) || new Date(iso).toISOString().slice(0, 10) !== iso) throw new Error("Invalid City permit date.");
  return iso;
}

try {
  const sql = `SELECT ${fields.map(f => `"${f}"`).join(",")} FROM "${resourceId}" WHERE "FOLDERNUMBER" IN (${permitNumbers.map(n => `'${n}'`).join(",")})`;
  const apiUrl = new URL("https://data.sanjoseca.gov/api/3/action/datastore_search_sql");
  apiUrl.searchParams.set("sql", sql);
  const response = await fetch(apiUrl, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`City source returned HTTP ${response.status}.`);
  const payload = await response.json() as { success: boolean; result?: { records: Record<string, string | null>[] } };
  if (!payload.success || payload.result?.records.length !== 2) throw new Error("The City source must return both selected housing permits.");
  const values = permitNumbers.map(permitNumber => {
    const record = payload.result!.records.find(r => r.FOLDERNUMBER === permitNumber);
    if (!record || !["Multiple Attached Dwellings", "1 & 2 Family Detached Dwellings"].includes(record.FOLDERDESC ?? "") ||
      !/Apartment|Single-Family|Accessory Dwelling Unit/.test(record.SUBTYPEDESCRIPTION ?? "") ||
      /pool|spa/i.test(`${record.FOLDERNAME} ${record.WORKDESCRIPTION}`)) throw new Error("A selected source record is not a verified housing permit.");
    const dwellingUnits = Number(record.DWELLINGUNITS);
    if (!Number.isInteger(dwellingUnits) || dwellingUnits < 1) throw new Error("Source dwelling units must be a positive integer.");
    const valuation = record.PERMITVALUATION === null ? null : Number(record.PERMITVALUATION);
    if (valuation !== null && !Number.isFinite(valuation)) throw new Error("Invalid source valuation.");
    if (!record.FOLDERNAME || !record.gx_location?.includes("SAN JOSE") || !record.Status || !record.WORKDESCRIPTION) throw new Error("Missing required City record fields.");
    return {
      sourceRecordId: permitNumber, dataSource: "City of San Jose Open Data",
      datasetName: "Active Building Permits", sourceUrl,
      businessName: record.FOLDERNAME, siteLocation: record.gx_location.trim().replace(/\s+/g, " "), city: "SAN JOSE",
      housingDetails: {
        permitNumber, projectType: record.SUBTYPEDESCRIPTION!, workDescription: record.WORKDESCRIPTION,
        dwellingUnits, status: record.Status, issuedDate: sourceDate(record.ISSUEDATE ?? null),
        finalDate: sourceDate(record.FINALDATE ?? null), permitValuation: valuation,
      },
    };
  });
  await db.transaction(async tx => {
    for (const value of values) {
      await tx.insert(countyPublicRecordsTable).values(value).onConflictDoUpdate({
        target: countyPublicRecordsTable.sourceRecordId,
        set: { ...value, importedAt: new Date(), updatedAt: new Date() },
      });
    }
  });
  console.log(`Imported ${values.length} genuine City housing permits (${values.map(r => r.housingDetails.dwellingUnits).join(" and ")} dwelling units).`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "City housing import failed.");
  process.exitCode = 1;
} finally {
  await pool.end();
}