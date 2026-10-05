import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, savedApplicationDraftsTable } from "@workspace/db";
import { ListSavedApplicationsResponse, UpdateSavedApplicationBody, UpdateSavedApplicationResponse } from "@workspace/api-zod";
import { requirePortalUser } from "../middlewares/portal-auth";
import { ensureStarterDrafts } from "../lib/saved-application-seeds";

const router = Router();

function serializeApplication(record: ReturnType<typeof UpdateSavedApplicationResponse.parse>) {
  // Generated Zod validators coerce OpenAPI date fields into Date objects.
  // Restore date-only wire values rather than letting JSON turn them into timestamps.
  return {
    ...record,
    timeline: record.timeline.map(event => ({
      ...event, date: event.date.toISOString().slice(0, 10),
    })),
  };
}

function respondWithDraft(row: typeof savedApplicationDraftsTable.$inferSelect) {
  return {
    id: row.id,
    applicationNumber: row.applicationNumber,
    applicantEmail: row.applicantEmail,
    accountOwner: row.accountOwner,
    projectName: row.projectName,
    projectAddress: row.projectAddress,
    applicationType: row.applicationType,
    status: row.status,
    description: row.description,
    dateSaved: row.dateSaved.toISOString(),
    lastUpdated: row.lastUpdated.toISOString(),
    isPresentationSubmission: row.isPresentationSubmission,
    submittedAt: row.submittedAt?.toISOString() ?? null,
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
  res.json(ListSavedApplicationsResponse.parse(rows.map(respondWithDraft)).map(serializeApplication));
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
  const ownerScope = and(
    eq(savedApplicationDraftsTable.id, id),
    eq(savedApplicationDraftsTable.ownerUserId, user.id),
    eq(savedApplicationDraftsTable.applicantEmail, user.email),
  );
  const [existing] = await db.select({ isPresentationSubmission: savedApplicationDraftsTable.isPresentationSubmission })
    .from(savedApplicationDraftsTable).where(ownerScope).limit(1);
  if (!existing) { res.status(404).json({ error: "Application not found." }); return; }
  if (existing.isPresentationSubmission) {
    res.status(409).json({ error: "Submitted presentation applications are read-only. View the application and its document information instead." });
    return;
  }
  const [updated] = await db.update(savedApplicationDraftsTable)
    .set({
      projectName: projectName.trim(), projectAddress: projectAddress.trim(),
      applicationType: applicationType.trim(), description: description.trim(),
      status: "In progress", lastUpdated: new Date(),
    })
    .where(and(ownerScope, eq(savedApplicationDraftsTable.isPresentationSubmission, false)))
    .returning();
  if (!updated) { res.status(409).json({ error: "This application is now read-only. Reload its details." }); return; }
  res.json(serializeApplication(UpdateSavedApplicationResponse.parse(respondWithDraft(updated))));
});

export default router;