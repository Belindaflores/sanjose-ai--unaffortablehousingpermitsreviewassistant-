import {
  date,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const countyPublicRecordsTable = pgTable("county_public_records", {
  sourceRecordId: text("source_record_id").primaryKey(),
  dataSource: text("data_source").notNull().default("County of Santa Clara Open Data"),
  datasetName: text("dataset_name").notNull(),
  sourceUrl: text("source_url").notNull(),
  housingDetails: jsonb("housing_details").$type<{
    permitNumber: string;
    projectType: string;
    workDescription: string;
    dwellingUnits: number;
    status: string;
    issuedDate: string | null;
    finalDate: string | null;
    permitValuation: number | null;
  }>(),
  businessName: text("business_name"),
  siteLocation: text("site_location"),
  city: text("city"),
  receivedDate: date("received_date", { mode: "string" }),
  dueDate: date("due_date", { mode: "string" }),
  revisionRequestedDate: date("revision_requested_date", { mode: "string" }),
  revisionSubmittedDate: date("revision_submitted_date", { mode: "string" }),
  latestRevisionRequestedDate: date("latest_revision_requested_date", { mode: "string" }),
  latestRevisionSubmittedDate: date("latest_revision_submitted_date", { mode: "string" }),
  planApprovedDate: date("plan_approved_date", { mode: "string" }),
  preliminaryInspectionDate: date("preliminary_inspection_date", { mode: "string" }),
  finalInspectionDate: date("final_inspection_date", { mode: "string" }),
  serviceCompleteDate: date("service_complete_date", { mode: "string" }),
  importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type CountyPublicRecord = typeof countyPublicRecordsTable.$inferSelect;