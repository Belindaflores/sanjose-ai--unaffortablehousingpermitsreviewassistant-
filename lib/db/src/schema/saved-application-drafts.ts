import { pgTable, text, timestamp, uniqueIndex, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export type AccountDocument = {
  name: string; fileName: string; category: string; required: boolean;
  uploadStatus: "Received"; uploadDate: string; fileType: string; fileSize: number; synthetic: boolean;
};
export type AccountTimelineEvent = {
  label: string; date: string | null; status: "complete" | "upcoming";
};

// Private account work and synthetic presentation submissions never enter the
// official-source records or the staff permit-review queue.
export const savedApplicationDraftsTable = pgTable("saved_application_drafts", {
  id: text("id").primaryKey(),
  applicationNumber: text("application_number").notNull(),
  ownerUserId: text("owner_user_id").notNull(),
  applicantEmail: text("applicant_email").notNull(),
  accountOwner: text("account_owner").notNull(),
  seedKey: text("seed_key"),
  projectName: text("project_name").notNull(),
  projectAddress: text("project_address").notNull(),
  applicationType: text("application_type").notNull(),
  status: text("status").notNull().default("Draft"),
  description: text("description").notNull().default(""),
  submissionDate: timestamp("submission_date", { withTimezone: true }),
  documents: jsonb("documents").$type<AccountDocument[]>().notNull().default([]),
  timeline: jsonb("timeline").$type<AccountTimelineEvent[]>().notNull().default([]),
  seedVersion: integer("seed_version").notNull().default(0),
  dateSaved: timestamp("date_saved", { withTimezone: true }).notNull().defaultNow(),
  lastUpdated: timestamp("last_updated", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  uniqueIndex("saved_application_drafts_owner_seed_unique").on(table.ownerUserId, table.seedKey),
]);

export const insertSavedApplicationDraftSchema = createInsertSchema(savedApplicationDraftsTable);
export type SavedApplicationDraft = typeof savedApplicationDraftsTable.$inferSelect;