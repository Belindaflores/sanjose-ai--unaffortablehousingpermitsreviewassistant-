import { ListBuildingPermitRecordsResponse } from "@workspace/api-zod";

type BuildingPermitRecord = ReturnType<typeof ListBuildingPermitRecordsResponse.parse>["records"][number];

export const BUILDING_RESOURCE_ID = "761b7ae8-3be1-4ad6-923d-c7af6404a904";
export const BUILDING_SOURCE_URL = "https://data.sanjoseca.gov/dataset/active-building-permits";
const API_URL = "https://data.sanjoseca.gov/api/3/action/datastore_search";
const fields = ["_id", "FOLDERNUMBER", "FOLDERNAME", "gx_location", "APPLICANT", "FOLDERDESC",
  "SUBTYPEDESCRIPTION", "WORKDESCRIPTION", "Status", "ISSUEDATE", "FINALDATE", "DWELLINGUNITS", "PERMITVALUATION"];

export function buildingSourceUrl(page: number, pageSize: number, query: string) {
  const url = new URL(API_URL);
  url.searchParams.set("resource_id", BUILDING_RESOURCE_ID);
  url.searchParams.set("limit", String(pageSize));
  url.searchParams.set("offset", String((page - 1) * pageSize));
  url.searchParams.set("sort", "_id asc");
  url.searchParams.set("fields", fields.join(","));
  if (query.trim()) url.searchParams.set("q", query.trim());
  return url;
}

export function mapBuildingRecord(record: Record<string, unknown>): BuildingPermitRecord {
  if (!Number.isSafeInteger(record._id) || Number(record._id) < 1) throw new Error("Invalid official record identifier.");
  const text = (key: string) => {
    const value = record[key];
    if (value === null || value === undefined) return null;
    if (typeof value !== "string") throw new Error(`Unexpected official field type: ${key}`);
    return value.trim() || null;
  };
  return {
    sourceId: Number(record._id), permitNumber: text("FOLDERNUMBER"), projectName: text("FOLDERNAME"),
    address: text("gx_location"), applicant: text("APPLICANT"), permitType: text("FOLDERDESC"),
    projectType: text("SUBTYPEDESCRIPTION"), workDescription: text("WORKDESCRIPTION"),
    status: text("Status"), issuedDate: text("ISSUEDATE"), finalDate: text("FINALDATE"),
    dwellingUnits: text("DWELLINGUNITS"), valuation: text("PERMITVALUATION"),
  };
}

type SourcePage = { total: number; records: BuildingPermitRecord[]; fetchedAt: string };
// Bounded, short-lived public-data cache. Failed requests are never shown as empty datasets.
const requests = new Map<string, { expires: number; promise: Promise<SourcePage> }>();

async function sourcePage(page: number, pageSize: number, query: string): Promise<SourcePage> {
  const url = buildingSourceUrl(page, pageSize, query);
  const key = url.toString();
  const cached = requests.get(key);
  if (cached && cached.expires > Date.now()) return cached.promise;
  if (requests.size >= 100) requests.delete(requests.keys().next().value!);
  const entry = {
    expires: Date.now() + 60_000,
    promise: fetch(url, { signal: AbortSignal.timeout(15_000) }).then(async response => {
      if (!response.ok) throw new Error(`Official source returned HTTP ${response.status}.`);
      const payload = await response.json() as {
        success?: boolean; result?: { total?: unknown; records?: Record<string, unknown>[] };
      };
      const result = payload.result;
      if (!payload.success || !result || !Number.isSafeInteger(result.total) ||
          Number(result.total) < 0 || !Array.isArray(result.records) || result.records.length > pageSize) {
        throw new Error("Official dataset returned an invalid response.");
      }
      return { total: Number(result.total), records: result.records.map(mapBuildingRecord), fetchedAt: new Date().toISOString() };
    }),
  };
  requests.set(key, entry);
  try {
    return await entry.promise;
  } catch (error) {
    // Share an explicit short-lived failure to avoid flooding a source outage.
    entry.expires = Date.now() + 5_000;
    throw error;
  }
}

export async function listBuildingPermits(page: number, pageSize: number, query: string) {
  const [result, dataset] = await Promise.all([
    sourcePage(page, pageSize, query),
    query.trim() ? sourcePage(1, 25, "") : Promise.resolve(null),
  ]);
  return {
    ...result, datasetTotal: dataset?.total ?? result.total, page, pageSize,
    nextPage: page * pageSize < result.total ? page + 1 : null,
    sourceName: "City of San José Open Data", datasetName: "Active Building Permits",
    sourceUrl: BUILDING_SOURCE_URL,
  };
}