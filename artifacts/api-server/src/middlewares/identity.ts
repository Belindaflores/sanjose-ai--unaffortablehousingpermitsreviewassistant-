import { clerkClient, getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";

export type Identity = { userId: string; role: "applicant" | "worker" };

declare global {
  namespace Express {
    interface Request {
      identity?: Identity;
    }
  }
}

export async function requireIdentity(req: Request, res: Response, next: NextFunction) {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Sign in required" });
    return;
  }
  try {
    // Fetch on each request: a stale browser claim cannot grant staff permissions.
    const user = await clerkClient.users.getUser(userId);
    req.identity = {
      userId,
      role: user.publicMetadata.role === "worker" ? "worker" : "applicant",
    };
    next();
  } catch (error) {
    req.log.error({ error }, "Could not verify account permissions");
    res.status(503).json({ error: "Account permissions unavailable" });
  }
}