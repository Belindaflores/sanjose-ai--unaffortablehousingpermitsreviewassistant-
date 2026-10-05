import { boolean, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export interface PresentationDocumentRecord {
  id: string;
  documentName: string;
  fileName: string;
  category: string;
  required: boolean;
  uploadStatus: "Received";
  uploadDate: string;
  fileType: string;
  fileSizeBytes: number;
  synthetic: true;
}
export interface PresentationTimelineRecord {
  label: string;
  date: string;
  status: "done" | "current" | "upcoming";
  documentsMilestone: boolean;
}

// Private drafts and presentation-only records never enter the real staff review queue.
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
  dateSaved: timestamp("date_saved", { withTimezone: true }).notNull().defaultNow(),
  lastUpdated: timestamp("last_updated", { withTimezone: true }).notNull().defaultNow(),
  presentationOnly: boolean("presentation_only").notNull().default(false),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  documents: jsonb("documents").$type<PresentationDocumentRecord[]>().notNull().default([]),
  timeline: jsonb("timeline").$type<PresentationTimelineRecord[]>().notNull().default([]),
}, table => [
  uniqueIndex("saved_application_drafts_owner_seed_unique").on(table.ownerUserId, table.seedKey),
]);

export const insertSavedApplicationDraftSchema = createInsertSchema(savedApplicationDraftsTable);
export type SavedApplicationDraft = typeof savedApplicationDraftsTable.$inferSelect;