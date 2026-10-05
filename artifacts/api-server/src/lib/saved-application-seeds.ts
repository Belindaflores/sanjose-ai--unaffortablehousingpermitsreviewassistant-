import { randomUUID } from "node:crypto";
import { db, savedApplicationDraftsTable } from "@workspace/db";

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
}