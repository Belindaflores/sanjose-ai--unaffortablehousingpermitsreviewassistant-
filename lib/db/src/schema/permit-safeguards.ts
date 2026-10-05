import { boolean, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const portalUsersTable = pgTable("portal_users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("applicant"),
  workspaceId: text("workspace_id").notNull().default("santa-clara-county"),
  staffAccessRequested: boolean("staff_access_requested").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const permitRuleConfigsTable = pgTable("permit_rule_configs", {
  id: text("id").primaryKey(),
  zips: jsonb("zips").$type<string[]>().notNull(),
  censusTracts: jsonb("census_tracts").$type<string[]>().notNull(),
  placeholder: boolean("placeholder").notNull().default(true),
  updatedBy: text("updated_by").notNull(),
  updateNote: text("update_note").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export const permitRejectedAttemptsTable = pgTable("permit_rejected_attempts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  projectAddress: text("project_address").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const permitUploadsTable = pgTable("permit_uploads", {
  objectPath: text("object_path").primaryKey(),
  ownerUserId: text("owner_user_id").notNull(),
  name: text("name").notNull(),
  size: integer("size").notNull(),
  contentType: text("content_type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const insertPortalUserSchema = createInsertSchema(portalUsersTable);
export const insertPermitRuleConfigSchema = createInsertSchema(permitRuleConfigsTable);
export const insertPermitRejectedAttemptSchema = createInsertSchema(permitRejectedAttemptsTable);
export const insertPermitUploadSchema = createInsertSchema(permitUploadsTable);