import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, permitApplicationsTable } from "@workspace/db";
import {
  CreatePermitApplicationBody,
  CreatePermitApplicationResponse,
  ListPermitApplicationsResponse,
  UpdatePermitApplicationBody,
  UpdatePermitApplicationParams,
  UpdatePermitApplicationResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

type PermitInput = typeof CreatePermitApplicationBody._output;
type PermitRow = typeof permitApplicationsTable.$inferSelect;

function asIso(value: string | Date) {
  return value instanceof Date ? value.toISOString() : value;
}

function toValues(application: PermitInput) {
  return {
    ...application,
    submittedAt: new Date(application.submittedAt),
    documents: application.documents.map((document) => ({
      ...document,
      receivedAt: document.receivedAt
        ? asIso(document.receivedAt)
        : undefined,
    })),
    notes: application.notes.map((note) => ({
      ...note,
      createdAt: asIso(note.createdAt),
    })),
  };
}

function toResponse(row: PermitRow) {
  const { createdAt: _createdAt, updatedAt: _updatedAt, ...application } = row;
  return {
    ...application,
    submittedAt: row.submittedAt.toISOString(),
  };
}

router.get("/permit-applications", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(permitApplicationsTable)
    .orderBy(desc(permitApplicationsTable.submittedAt));

  res.json(ListPermitApplicationsResponse.parse(rows.map(toResponse)));
});

router.post("/permit-applications", async (req, res): Promise<void> => {
  const parsed = CreatePermitApplicationBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid permit application");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [saved] = await db
    .insert(permitApplicationsTable)
    .values(toValues(parsed.data))
    .onConflictDoNothing()
    .returning();

  if (!saved) {
    res.status(409).json({ error: "Application ID already exists" });
    return;
  }

  res.status(201).json(CreatePermitApplicationResponse.parse(toResponse(saved)));
});

router.patch("/permit-applications/:id", async (req, res): Promise<void> => {
  const params = UpdatePermitApplicationParams.safeParse(req.params);
  const body = UpdatePermitApplicationBody.safeParse(req.body);
  if (!params.success) {
    req.log.warn(
      { errors: params.error.message },
      "Invalid permit application ID",
    );
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    req.log.warn(
      { errors: body.error.message },
      "Invalid permit application update",
    );
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [saved] = await db
    .update(permitApplicationsTable)
    .set(toValues(body.data))
    .where(eq(permitApplicationsTable.id, params.data.id))
    .returning();

  if (!saved) {
    res.status(404).json({ error: "Saved permit application not found" });
    return;
  }

  res.json(UpdatePermitApplicationResponse.parse(toResponse(saved)));
});

export default router;