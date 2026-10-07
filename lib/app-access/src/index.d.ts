import type { IncomingMessage, ServerResponse } from "node:http";
export function hasAppAccess(req: IncomingMessage): boolean;
export function webAccessGate(req: IncomingMessage, res: ServerResponse, next: () => void): void;
export function apiAccessGate(req: IncomingMessage, res: ServerResponse, next: () => void): Promise<void>;
