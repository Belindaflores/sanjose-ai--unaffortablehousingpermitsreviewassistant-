import { boolean, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export interface PresentationDocument {
  id: string;
  name: string;
  fileName: string;
  category: string;
  required: boolean;
  uploadStatus: "Received";
  uploadedAt: string;
  fileType: "application/pdf";
  sizeBytes: number;
  synthetic: boolean;
}

export interface PresentationTimelineEvent {
  label: string;
  date: string;
  status: "complete" | "current" | "upcoming";
  documentIds: string[];
}

// Private drafts and explicitly disclosed portal presentation records never enter
// the official-submission model, public City records, or staff review queue.
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
  isPresentationSubmission: boolean("is_presentation_submission").notNull().default(false),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  documents: jsonb("documents").$type<PresentationDocument[]>().notNull().default([]),
  timeline: jsonb("timeline").$type<PresentationTimelineEvent[]>().notNull().default([]),
  dateSaved: timestamp("date_saved", { withTimezone: true }).notNull().defaultNow(),
  lastUpdated: timestamp("last_updated", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  uniqueIndex("saved_application_drafts_owner_seed_unique").on(table.ownerUserId, table.seedKey),
]);

export const insertSavedApplicationDraftSchema = createInsertSchema(savedApplicationDraftsTable);
export type SavedApplicationDraft = typeof savedApplicationDraftsTable.$inferSelect;