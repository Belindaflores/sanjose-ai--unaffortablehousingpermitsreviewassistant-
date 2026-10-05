import { Router } from "express";
import { Readable } from "node:stream";
import { eq } from "drizzle-orm";
import { db, permitUploadsTable, portalUsersTable } from "@workspace/db";
import { RequestUploadUrlBody, RequestUploadUrlResponse } from "@workspace/api-zod";
import { ObjectStorageService } from "../lib/objectStorage";
import { requirePortalUser, isStaff } from "../middlewares/portal-auth";

export const storage = new ObjectStorageService();
export async function validateUploadedDocument(objectPath: string, ownerUserId: string) {
  const [upload] = await db.select().from(permitUploadsTable).where(eq(permitUploadsTable.objectPath, objectPath));
  if (!upload || upload.ownerUserId !== ownerUserId) throw new Error("Document must be uploaded by the signed-in user.");
  const file = await storage.getObjectEntityFile(objectPath);
  const [metadata] = await file.getMetadata();
  if (Number(metadata.size) !== upload.size || metadata.contentType !== upload.contentType) throw new Error("Uploaded document is incomplete or does not match its declared size/type.");
  await storage.trySetObjectEntityAclPolicy(objectPath, { owner: ownerUserId, visibility: "private" });
  return upload;
}
const router = Router();
router.use("/storage", requirePortalUser);
router.post("/storage/uploads/request-url", async (req, res): Promise<void> => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Choose a PDF, PNG, or JPEG file between 1 byte and 10 MB." }); return; }
  const uploadURL = await storage.getObjectEntityUploadURL();
  const objectPath = storage.normalizeObjectEntityPath(uploadURL);
  await db.insert(permitUploadsTable).values({ ...parsed.data, objectPath, ownerUserId: res.locals.portalUser.id });
  res.json(RequestUploadUrlResponse.parse({ uploadURL, objectPath }));
});
router.get("/storage/objects/{*objectPath}", async (req, res): Promise<void> => {
  const segments = req.params.objectPath;
  const objectPath = `/objects/${Array.isArray(segments) ? segments.join("/") : segments}`;
  const [upload] = await db.select().from(permitUploadsTable).where(eq(permitUploadsTable.objectPath, objectPath));
  if (!upload || (!isStaff(res.locals.portalUser) && upload.ownerUserId !== res.locals.portalUser.id)) { res.status(404).json({ error: "Document not found." }); return; }
  if (isStaff(res.locals.portalUser)) {
    const [owner] = await db.select({ workspaceId: portalUsersTable.workspaceId }).from(portalUsersTable).where(eq(portalUsersTable.id, upload.ownerUserId));
    if (!owner || owner.workspaceId !== res.locals.portalUser.workspaceId) { res.status(404).json({ error: "Document not found." }); return; }
  }
  try {
    const file = await storage.getObjectEntityFile(objectPath);
    const response = await storage.downloadObject(file, 0);
    res.setHeader("Content-Type", upload.contentType);
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(upload.name)}`);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    Readable.fromWeb(response.body as never).pipe(res);
  } catch { res.status(404).json({ error: "Uploaded file is unavailable." }); }
});
export default router;