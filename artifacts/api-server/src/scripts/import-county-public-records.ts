import { sql } from "drizzle-orm";
import { db, pool, countyPublicRecordsTable } from "@workspace/db";

const datasetName = "SCC Plan Check Progress";
const sourceUrl =
  "https://data.sccgov.org/Environment/SCC-Plan-Check-Progress/skd7-7ix3";
const apiUrl = new URL("https://data.sccgov.org/resource/skd7-7ix3.json");
apiUrl.searchParams.set(
  "$select",
  [
    "record_id",
    "business_name",
    "site_location",
    "city",
    "received_date",
    "due_date",
    "date_revision_requested",
    "date_revision_submitted",
    "date_revision_requested_2",
    "date_revision_submitted_2",
    "date_plan_approved",
    "preliminary_final",
    "final_inspection",
    "service_complete_date",
  ].join(","),
);
apiUrl.searchParams.set(
  "$where",
  "record_id IS NOT NULL AND received_date IS NOT NULL",
);
apiUrl.searchParams.set("$order", "received_date DESC");
apiUrl.searchParams.set("$limit", "100");

type SocrataRecord = {
  record_id?: string;
  business_name?: string | null;
  site_location?: string | null;
  city?: string | null;
  received_date?: string | null;
  due_date?: string | null;
  date_revision_requested?: string | null;
  date_revision_submitted?: string | null;
  date_revision_requested_2?: string | null;
  date_revision_submitted_2?: string | null;
  date_plan_approved?: string | null;
  preliminary_final?: string | null;
  final_inspection?: string | null;
  service_complete_date?: string | null;
};

function toCalendarDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  if (!match || Number.isNaN(Date.parse(`${match[1]}T00:00:00Z`))) {
    throw new Error(`Unexpected County dataset date value: ${value}`);
  }
  return match[1];
}

async function importRecords(): Promise<void> {
  const response = await fetch(apiUrl);
  if (!response.ok) {
    throw new Error(
      `County Open Data API returned ${response.status} ${response.statusText}`,
    );
  }

  const sourceRecords = (await response.json()) as SocrataRecord[];
  const records = sourceRecords
    .filter((record): record is SocrataRecord & { record_id: string } =>
      Boolean(record.record_id),
    )
    .map((record) => ({
      sourceRecordId: record.record_id,
      dataSource: "County of Santa Clara Open Data",
      datasetName,
      sourceUrl,
      businessName: record.business_name ?? null,
      siteLocation: record.site_location ?? null,
      city: record.city ?? null,
      receivedDate: toCalendarDate(record.received_date),
      dueDate: toCalendarDate(record.due_date),
      revisionRequestedDate: toCalendarDate(record.date_revision_requested),
      revisionSubmittedDate: toCalendarDate(record.date_revision_submitted),
      latestRevisionRequestedDate: toCalendarDate(
        record.date_revision_requested_2,
      ),
      latestRevisionSubmittedDate: toCalendarDate(
        record.date_revision_submitted_2,
      ),
      planApprovedDate: toCalendarDate(record.date_plan_approved),
      preliminaryInspectionDate: toCalendarDate(record.preliminary_final),
      finalInspectionDate: toCalendarDate(record.final_inspection),
      serviceCompleteDate: toCalendarDate(record.service_complete_date),
      importedAt: new Date(),
    }));

  if (records.length < 20) {
    throw new Error(
      `County Open Data returned only ${records.length} usable records; refusing to import fewer than 20.`,
    );
  }

  const saved = await db
    .insert(countyPublicRecordsTable)
    .values(records)
    .onConflictDoUpdate({
      target: countyPublicRecordsTable.sourceRecordId,
      set: {
        dataSource: sql`excluded.data_source`,
        datasetName: sql`excluded.dataset_name`,
        sourceUrl: sql`excluded.source_url`,
        businessName: sql`excluded.business_name`,
        siteLocation: sql`excluded.site_location`,
        city: sql`excluded.city`,
        receivedDate: sql`excluded.received_date`,
        dueDate: sql`excluded.due_date`,
        revisionRequestedDate: sql`excluded.revision_requested_date`,
        revisionSubmittedDate: sql`excluded.revision_submitted_date`,
        latestRevisionRequestedDate: sql`excluded.latest_revision_requested_date`,
        latestRevisionSubmittedDate: sql`excluded.latest_revision_submitted_date`,
        planApprovedDate: sql`excluded.plan_approved_date`,
        preliminaryInspectionDate: sql`excluded.preliminary_inspection_date`,
        finalInspectionDate: sql`excluded.final_inspection_date`,
        serviceCompleteDate: sql`excluded.service_complete_date`,
        importedAt: sql`excluded.imported_at`,
        updatedAt: new Date(),
      },
    })
    .returning({ sourceRecordId: countyPublicRecordsTable.sourceRecordId });

  console.info(
    `Imported/refreshed ${saved.length} County public records from ${datasetName}.`,
  );
}

try {
  await importRecords();
} catch (error) {
  console.error("County public data import failed.", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}