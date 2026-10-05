import { randomUUID } from "node:crypto";
import { db, savedApplicationDraftsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { opalPresentationDocuments, opalPresentationTimeline } from "./opal-presentation-documents";

export const starterDraftEmail = "alondracampos280@gmail.com";

// These are private starter drafts, not City permit records or submissions.
const startingDrafts = [
  {
    seedKey: "meridian-apartments",
    projectName: "Meridian Avenue apartment project",
    projectAddress: "969 MERIDIAN AV, SAN JOSE CA 95126",
    applicationType: "Apartment construction",
    status: "Draft",
    description: "Apartment housing project. Details are saved for this account and have not been submitted for review.",
  },
  {
    seedKey: "opal-adu",
    projectName: "Opal Drive detached ADU",
    projectAddress: "973 OPAL DR 2, SAN JOSE CA 95117",
    applicationType: "Accessory dwelling unit",
    status: "In progress",
    description: "Detached accessory dwelling unit. Details are saved for this account and have not been submitted for review.",
  },
] as const;

export async function ensureStarterDrafts(user: { id: string; email: string; name: string }) {
  if (user.email.toLowerCase() !== starterDraftEmail) return;
  for (const draft of startingDrafts) {
    const id = randomUUID();
    await db.insert(savedApplicationDraftsTable).values({
      id,
      applicationNumber: `DRAFT-${id.slice(0, 8).toUpperCase()}`,
      ownerUserId: user.id,
      applicantEmail: user.email,
      accountOwner: "Alondra Campos",
      ...draft,
    }).onConflictDoNothing({ target: [savedApplicationDraftsTable.ownerUserId, savedApplicationDraftsTable.seedKey] });
  }
  // The requested submitted display is explicitly a presentation, not a real
  // uploaded submission. Upgrade once without touching Meridian or public data.
  const [opal] = await db.select({ id: savedApplicationDraftsTable.id })
    .from(savedApplicationDraftsTable).where(and(
      eq(savedApplicationDraftsTable.ownerUserId, user.id),
      eq(savedApplicationDraftsTable.applicantEmail, user.email),
      eq(savedApplicationDraftsTable.seedKey, "opal-adu"),
      eq(savedApplicationDraftsTable.presentationOnly, false),
    ));
  if (opal) {
    await db.update(savedApplicationDraftsTable).set({
      applicationNumber: `PORTAL-${opal.id.slice(0, 8).toUpperCase()}`,
      projectName: "Opal Drive Detached ADU",
      status: "Submitted — awaiting initial review",
      presentationOnly: true,
      submittedAt: new Date("2026-10-04T19:00:00.000Z"),
      description: "Detached accessory dwelling unit with a complete presentation document set, awaiting initial review. This is a portal presentation record, not an official government submission.",
      documents: opalPresentationDocuments,
      timeline: opalPresentationTimeline,
      lastUpdated: new Date(),
    }).where(and(eq(savedApplicationDraftsTable.id, opal.id), eq(savedApplicationDraftsTable.presentationOnly, false)));
  }
}