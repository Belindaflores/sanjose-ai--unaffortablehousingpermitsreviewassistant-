import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

type PermitDocument = {
  category: string;
  label: string;
  required: boolean;
  received: boolean;
  fileName?: string;
  receivedAt?: string;
  objectPath?: string;
};

type PermitTimelineEvent = {
  label: string;
  status: "completed" | "current" | "upcoming";
  date: string;
  detail: string;
};

type PermitStaffNote = {
  id: string;
  author: string;
  body: string;
  createdAt: string;
};

export const permitApplicationsTable = pgTable("permit_applications", {
  id: text("id").primaryKey(),
  ownerUserId: text("owner_user_id"),
  claimed_affordable: boolean("claimed_affordable").notNull().default(false),
  claimed_underserved: boolean("claimed_underserved").notNull().default(false),
  verification_status: text("verification_status").notNull().default("Unverified"),
  priorityClaims: jsonb("priority_claims").$type<{ affordable: { status: "Unverified" | "Verified" | "Rejected"; note?: string; by?: string; at?: string }; underserved: { status: "Unverified" | "Verified" | "Rejected"; note?: string; by?: string; at?: string } }>(),
  reviewDecisions: jsonb("review_decisions").$type<{ jurisdiction?: { note: string; by: string; at: string }; safety?: { note: string; by: string; at: string; document: string }[] }>(),
  requiredReviewers: jsonb("required_reviewers").$type<string[]>().notNull().default([]),
  censusTract: text("census_tract").notNull().default(""),
  dataSource: text("data_source").notNull().default("Prototype Submission"),
  applicantName: text("applicant_name").notNull(),
  companyName: text("company_name").notNull(),
  email: text("email").notNull(),
  projectName: text("project_name").notNull(),
  projectAddress: text("project_address").notNull(),
  permitType: text("permit_type").notNull(),
  projectType: text("project_type").notNull(),
  housingUnits: integer("housing_units").notNull(),
  affordableHousing: boolean("affordable_housing").notNull(),
  underservedCommunity: boolean("underserved_community").notNull(),
  estimatedCost: doublePrecision("estimated_cost").notNull(),
  description: text("description").notNull(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull(),
  aiStatus: text("ai_status").notNull(),
  priority: text("priority").notNull(),
  assignedDepartment: text("assigned_department").notNull(),
  reviewStatus: text("review_status").notNull(),
  completenessScore: integer("completeness_score").notNull(),
  documents: jsonb("documents").$type<PermitDocument[]>().notNull(),
  flags: jsonb("flags").$type<string[]>().notNull(),
  aiSummary: text("ai_summary").notNull(),
  intakeAnalysis: jsonb("intake_analysis").$type<Record<string, unknown>>(),
  recommendedRouting: jsonb("recommended_routing").$type<string[]>().notNull(),
  timeline: jsonb("timeline").$type<PermitTimelineEvent[]>().notNull(),
  notes: jsonb("notes").$type<PermitStaffNote[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertPermitApplicationSchema = createInsertSchema(
  permitApplicationsTable,
).omit({ createdAt: true, updatedAt: true });
export type InsertPermitApplication = z.infer<
  typeof insertPermitApplicationSchema
>;
export type PermitApplicationRecord =
  typeof permitApplicationsTable.$inferSelect;