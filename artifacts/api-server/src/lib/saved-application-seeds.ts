import { randomUUID } from "node:crypto";
import { db, savedApplicationDraftsTable } from "@workspace/db";
import { and, eq, lt } from "drizzle-orm";
import { opalDocuments, opalTimeline, presentationDate } from "./account-presentation-data";

export const starterDraftEmail = "alondracampos280@gmail.com";

// This account's synthetic presentation data is not an official City submission.
const startingDrafts = [
  {
    seedKey: "meridian-apartments",
    applicationNumber: "DRAFT-2026-0317",
    projectName: "Meridian Avenue apartment project",
    projectAddress: "969 Meridian Avenue, San José, CA 95126",
    applicationType: "Apartment construction",
    status: "Draft",
    description: "Apartment housing project. Details are saved for this account and have not been submitted for review.",
    submissionDate: null, documents: [], timeline: [],
    lastUpdated: new Date(),
  },
  {
    seedKey: "opal-adu",
    applicationNumber: "APP-2026-1047",
    projectName: "Opal Drive Detached ADU",
    projectAddress: "973 Opal Drive, San José, CA 95117",
    applicationType: "Accessory Dwelling Unit",
    status: "Submitted",
    description: "Synthetic detached accessory dwelling unit application for the account presentation. Not an official City submission.",
    submissionDate: new Date(presentationDate),
    documents: opalDocuments, timeline: opalTimeline,
    lastUpdated: new Date(presentationDate),
  },
];

export async function ensureStarterDrafts(user: { id: string; email: string; name: string }) {
  if (user.email.toLowerCase() !== starterDraftEmail) return;
  await db.transaction(async tx => {
    for (const draft of startingDrafts) {
      const values = { ...draft, seedVersion: 1, accountOwner: "Alondra Campos" };
      await tx.insert(savedApplicationDraftsTable).values({
        ...values, id: randomUUID(), ownerUserId: user.id, applicantEmail: user.email,
      }).onConflictDoUpdate({
        target: [savedApplicationDraftsTable.ownerUserId, savedApplicationDraftsTable.seedKey],
        set: values,
        // Upgrade once, preserving existing IDs and all later applicant edits.
        setWhere: and(eq(savedApplicationDraftsTable.applicantEmail, user.email), lt(savedApplicationDraftsTable.seedVersion, 1)),
      });
    }
  });
}