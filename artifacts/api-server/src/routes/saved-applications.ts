import { Router } from "express";
import { and, desc, eq, ne } from "drizzle-orm";
import { db, savedApplicationDraftsTable } from "@workspace/db";
import { ListSavedApplicationsResponse, UpdateSavedApplicationBody, UpdateSavedApplicationResponse } from "@workspace/api-zod";
import { requirePortalUser } from "../middlewares/portal-auth";
import { ensureStarterDrafts } from "../lib/saved-application-seeds";

const router = Router();

function respondWithDraft(row: typeof savedApplicationDraftsTable.$inferSelect) {
  return {
    id: row.id,
    applicationNumber: row.applicationNumber,
    applicantEmail: row.applicantEmail,
    accountOwner: row.accountOwner,
    applicantName: row.accountOwner,
    address: row.projectAddress,
    projectName: row.projectName,
    projectAddress: row.projectAddress,
    applicationType: row.applicationType,
    status: row.status,
    description: row.description,
    dateSaved: row.dateSaved.toISOString(),
    lastUpdated: row.lastUpdated.toISOString(),
    submissionDate: row.submissionDate?.toISOString() ?? null,
    documents: row.documents,
    timeline: row.timeline,
  };
}

router.get("/saved-applications", requirePortalUser, async (_req, res): Promise<void> => {
  const user = res.locals.portalUser;
  await ensureStarterDrafts(user);
  const rows = await db.select().from(savedApplicationDraftsTable)
    .where(and(eq(savedApplicationDraftsTable.ownerUserId, user.id), eq(savedApplicationDraftsTable.applicantEmail, user.email)))
    .orderBy(desc(savedApplicationDraftsTable.lastUpdated));
  res.json(ListSavedApplicationsResponse.parse(rows.map(respondWithDraft)));
});

router.patch("/saved-applications/:id", requirePortalUser, async (req, res): Promise<void> => {
  const id = req.params.id;
  if (typeof id !== "string" || !id) { res.status(400).json({ error: "Invalid saved application number." }); return; }
  const input = UpdateSavedApplicationBody.safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: "Enter valid saved application details." }); return; }
  const { projectName, projectAddress, applicationType, description } = input.data;
  if (![projectName, projectAddress, applicationType].every(value => value.trim())) {
    res.status(400).json({ error: "Project name, address, and application type are required." });
    return;
  }
  const user = res.locals.portalUser;
  const [updated] = await db.update(savedApplicationDraftsTable)
    .set({
      projectName: projectName.trim(), projectAddress: projectAddress.trim(),
      applicationType: applicationType.trim(), description: description.trim(),
      status: "In progress", lastUpdated: new Date(),
    })
    .where(and(eq(savedApplicationDraftsTable.id, id),
      eq(savedApplicationDraftsTable.ownerUserId, user.id),
      eq(savedApplicationDraftsTable.applicantEmail, user.email),
      ne(savedApplicationDraftsTable.status, "Submitted")))
    .returning();
  if (!updated) {
    const [owned] = await db.select({ id: savedApplicationDraftsTable.id }).from(savedApplicationDraftsTable)
      .where(and(eq(savedApplicationDraftsTable.id, id), eq(savedApplicationDraftsTable.ownerUserId, user.id),
        eq(savedApplicationDraftsTable.applicantEmail, user.email)));
    res.status(owned ? 409 : 404).json({ error: owned ? "Submitted applications cannot be edited as drafts." : "Application not found." });
    return;
  }
  res.json(UpdateSavedApplicationResponse.parse(respondWithDraft(updated)));
});

export default router;