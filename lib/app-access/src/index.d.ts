import type { IncomingMessage, ServerResponse } from "node:http";
export function hasAppAccess(req: IncomingMessage): boolean;
export function sameOrigin(req: IncomingMessage): boolean;
export function getPortalRole(req: IncomingMessage): "applicant" | "worker" | null;
export function setPortalRole(req: IncomingMessage, res: ServerResponse, role: "applicant" | "worker" | null): void;
export function webAccessGate(req: IncomingMessage, res: ServerResponse, next: () => void): void;
export function apiAccessGate(req: IncomingMessage, res: ServerResponse, next: () => void): Promise<void>;
