import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { PermitApplicationRecord } from "../../../lib/db/src/schema/permit-applications";

// Only the identity provider and persistence layer are replaced. The real
// identity middleware, router, validators and HTTP response handling run below.
const state = vi.hoisted(() => ({
  rows: [] as PermitApplicationRecord[],
  roles: new Map<string, string>(),
  lookups: 0,
}));

vi.mock("@clerk/express", () => ({
  getAuth: (req: express.Request) => ({
    userId: req.header("x-test-session-user") ?? null,
  }),
  clerkClient: {
    users: {
      getUser: async (userId: string) => {
        state.lookups++;
        return { publicMetadata: { role: state.roles.get(userId) } };
      },
    },
  },
}));

vi.mock("@workspace/db", async () => {
  const { PgDialect } = await import("drizzle-orm/pg-core");
  const { permitApplicationsTable } = await import(
    "../../../lib/db/src/schema/permit-applications"
  );
  const dialect = new PgDialect();

  function matchingRows(condition: unknown): PermitApplicationRecord[] {
    if (condition === undefined) return [...state.rows];
    const query = dialect.sqlToQuery(condition as Parameters<typeof dialect.sqlToQuery>[0]);
    if (/"owner_id"\s*=\s*\$1/.test(query.sql)) {
      return state.rows.filter(row => row.ownerId === query.params[0]);
    }
    if (/"id"\s*=\s*\$1/.test(query.sql)) {
      return state.rows.filter(row => row.id === query.params[0]);
    }
    throw new Error(`Unexpected permit query: ${query.sql}`);
  }

  return {
    permitApplicationsTable,
    db: {
      select: () => ({
        from: () => ({
          where: (condition: unknown) => ({
            orderBy: () =>
              matchingRows(condition).sort(
                (a, b) => b.submittedAt.getTime() - a.submittedAt.getTime(),
              ),
          }),
        }),
      }),
      insert: () => ({
        values: (values: PermitApplicationRecord) => ({
          onConflictDoNothing: () => ({
            returning: () => {
              if (state.rows.some(row => row.id === values.id)) return [];
              const row = { ...values, createdAt: new Date(), updatedAt: new Date() };
              state.rows.push(row);
              return [row];
            },
          }),
        }),
      }),
      update: () => ({
        set: (values: Partial<PermitApplicationRecord>) => ({
          where: (condition: unknown) => ({
            returning: () => {
              const found = matchingRows(condition);
              // Drizzle omits undefined fields in .set(), rather than clearing them.
              const defined = Object.fromEntries(
                Object.entries(values).filter(([, value]) => value !== undefined),
              );
              for (const row of found) Object.assign(row, defined);
              return found;
            },
          }),
        }),
      }),
    },
  };
});

import router from "../src/routes/index";

const staffNote = {
  id: "note-1",
  author: "Reviewer",
  body: "Internal note",
  createdAt: "2026-01-01T00:00:00.000Z",
};

function permit(id: string, ownerId: string | null): PermitApplicationRecord {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id,
    ownerId,
    applicantName: "Applicant",
    companyName: "Example",
    email: "applicant@example.com",
    projectName: "Project",
    projectAddress: "123 Main St",
    permitType: "Building",
    projectType: "Residential",
    housingUnits: 1,
    affordableHousing: false,
    underservedCommunity: false,
    estimatedCost: 1000,
    description: "Description",
    submittedAt: now,
    aiStatus: "Ready for Human Review",
    priority: "Normal",
    assignedDepartment: "Building",
    reviewStatus: "New",
    completenessScore: 80,
    documents: [],
    flags: [],
    aiSummary: "Summary",
    recommendedRouting: [],
    timeline: [],
    notes: [staffNote],
    createdAt: now,
    updatedAt: now,
  };
}

describe("permit access over HTTP", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use("/api", router);
    server = await new Promise<Server>(resolve => {
      const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  });

  afterAll(async () => {
    if (server) await new Promise<void>((resolve, reject) =>
      server.close(error => error ? reject(error) : resolve()),
    );
  });

  beforeEach(() => {
    state.rows = [permit("owned-a", "applicant-a"), permit("owned-b", "applicant-b"), permit("legacy", null)];
    state.roles = new Map([
      ["applicant-a", "applicant"],
      ["applicant-b", "applicant"],
      ["worker", "worker"],
    ]);
    state.lookups = 0;
  });

  async function request(
    method: string,
    path: string,
    userId?: string,
    body?: object,
    extraHeaders: Record<string, string> = {},
  ) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(userId ? { "x-test-session-user": userId } : {}),
        ...(body ? { "content-type": "application/json" } : {}),
        ...extraHeaders,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(`${method} ${path} returned ${response.status}: ${text}`);
    }
    return { status: response.status, body: parsed as any };
  }

  it("returns 401 before reading or changing permits without a session", async () => {
    for (const [method, path, body] of [
      ["GET", "/me", undefined],
      ["GET", "/permit-applications", undefined],
      ["POST", "/permit-applications", permit("new", null)],
      ["PATCH", "/permit-applications/owned-b", { reviewStatus: "Approved" }],
    ] as const) {
      const result = await request(method, path, undefined, body);
      expect(result.status).toBe(401);
    }
    expect(state.lookups).toBe(0);
    expect(state.rows).toHaveLength(3);
    expect(state.rows[1].reviewStatus).toBe("New");
  });

  it("isolates each applicant's list from other owners and ownerless legacy permits", async () => {
    for (const [userId, expectedId] of [
      ["applicant-a", "owned-a"],
      ["applicant-b", "owned-b"],
    ]) {
      const result = await request("GET", "/permit-applications", userId);
      expect(result.status).toBe(200);
      expect(result.body.map((row: { id: string }) => row.id)).toEqual([expectedId]);
      expect(result.body[0].notes).toEqual([]);
      expect(result.body[0]).not.toHaveProperty("ownerId");
    }
  });

  it("forbids applicant review updates, including another applicant's record", async () => {
    for (const id of ["owned-b", "owned-a", "legacy"]) {
      const result = await request("PATCH", `/permit-applications/${id}`, "applicant-a", {
        reviewStatus: "Approved",
        notes: [],
      });
      expect(result.status).toBe(403);
      expect(state.rows.find(row => row.id === id)?.reviewStatus).toBe("New");
      expect(state.rows.find(row => row.id === id)?.notes).toEqual([staffNote]);
    }
  });

  it("allows only a server-verified worker to review, without changing ownership", async () => {
    const spoofed = await request("PATCH", "/permit-applications/owned-b", "applicant-a",
      { reviewStatus: "Approved" }, { "x-test-role": "worker" });
    expect(spoofed.status).toBe(403);

    const list = await request("GET", "/permit-applications", "worker");
    expect(list.status).toBe(200);
    expect(list.body.map((row: { id: string }) => row.id).sort()).toEqual(["legacy", "owned-a", "owned-b"]);
    expect(list.body.find((row: { id: string }) => row.id === "legacy").notes).toEqual([staffNote]);

    const updated = await request("PATCH", "/permit-applications/owned-b", "worker", {
      reviewStatus: "Approved",
      assignedDepartment: "Planning",
      ownerId: "worker",
      applicantName: "Tampered",
    });
    expect(updated.status).toBe(200);
    expect(updated.body.reviewStatus).toBe("Approved");
    expect(updated.body.assignedDepartment).toBe("Planning");
    expect(updated.body).not.toHaveProperty("ownerId");
    expect(state.rows[1].ownerId).toBe("applicant-b");
    expect(state.rows[1].applicantName).toBe("Applicant");
  });

  it("assigns owner and initial review fields on the server despite a forged submission", async () => {
    const submitted = {
      ...permit("new-permit", "applicant-b"),
      submittedAt: "2020-01-01T00:00:00.000Z",
      reviewStatus: "Approved",
      notes: [staffNote],
    };
    const result = await request("POST", "/permit-applications", "applicant-a", submitted);
    expect(result.status).toBe(201);
    expect(state.rows.find(row => row.id === "new-permit")).toMatchObject({
      ownerId: "applicant-a",
      reviewStatus: "New",
      notes: [],
    });
    expect(new Date(result.body.submittedAt).getTime()).toBeGreaterThan(new Date("2020-01-01").getTime());
    expect(result.body).not.toHaveProperty("ownerId");
    expect((await request("GET", "/permit-applications", "applicant-a")).body.map(
      (row: { id: string }) => row.id,
    )).toContain("new-permit");
    expect((await request("GET", "/permit-applications", "applicant-b")).body.map(
      (row: { id: string }) => row.id,
    )).not.toContain("new-permit");
    expect((await request("POST", "/permit-applications", "worker", submitted)).status).toBe(403);
  });
});