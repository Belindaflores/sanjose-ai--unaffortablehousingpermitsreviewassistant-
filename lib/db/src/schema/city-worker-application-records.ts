import { sql } from "drizzle-orm";
import { boolean, check, date, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const cityWorkerApplicationRecordsTable = pgTable("city_worker_application_records", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().default("santa-clara-county"),
  permitNumber: text("permit_number").notNull().unique(),
  projectName: text("project_name").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zipCode: text("zip_code").notNull(),
  applicationType: text("application_type").notNull(),
  totalUnits: integer("total_units").notNull(),
  affordableUnits: integer("affordable_units").notNull(),
  housingCategory: text("housing_category").notNull(),
  status: text("status").notNull(),
  priority: text("priority").notNull().default("Normal"),
  department: text("department").notNull(),
  sourceType: text("source_type").notNull().default("Synthetic data modeled on public records"),
  isSynthetic: boolean("is_synthetic").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  recordCategory: text("record_category").notNull(),
  housingType: text("housing_type").notNull(),
  workType: text("work_type").notNull(),
  sourceStatus: text("source_status").notNull(),
  issuedDate: date("issued_date", { mode: "string" }),
  finalDate: date("final_date", { mode: "string" }),
  submittedDate: date("submitted_date", { mode: "string" }).notNull(),
  description: text("description").notNull(),
  sourceUrl: text("source_url").notNull(),
}, t => [
  index("city_worker_records_workspace_category_idx").on(t.workspaceId, t.recordCategory),
  check("city_worker_records_unit_bounds", sql`${t.totalUnits} >= 0 AND ${t.affordableUnits} >= 0 AND ${t.affordableUnits} <= ${t.totalUnits}`),
  check("city_worker_records_synthetic", sql`${t.isSynthetic} = true AND ${t.sourceType} = 'Synthetic data modeled on public records'`),
  check("city_worker_records_category", sql`${t.recordCategory} IN ('City Housing Permits', 'County Public Data', 'Prototype Submissions')`),
  check("city_worker_records_priority", sql`${t.priority} IN ('Normal', 'High', 'Urgent')`),
  check("city_worker_records_city", sql`${t.recordCategory} <> 'City Housing Permits' OR (${t.city} IN ('San José', 'San Jose') AND ${t.state} IN ('California', 'CA'))`),
]);
export const insertCityWorkerApplicationRecordSchema = createInsertSchema(cityWorkerApplicationRecordsTable);
export type CityWorkerApplicationRecord = typeof cityWorkerApplicationRecordsTable.$inferSelect;
export type InsertCityWorkerApplicationRecord = z.infer<typeof insertCityWorkerApplicationRecordSchema>;