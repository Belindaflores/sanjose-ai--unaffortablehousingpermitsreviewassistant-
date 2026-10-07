import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { gatePage } from "./gate-page.mjs";

const COOKIE = "scc_app_access";
const WINDOW = 15 * 60 * 1000;
const attempts = new Map();
let globalFailures = { count: 0, until: 0 };

function configuration() {
  const passcode = process.env.APP_PASSCODE;
  const key = process.env.SESSION_SECRET;
  return /^[0-9]{4}$/.test(passcode ?? "") && key ? { passcode, key } : null;
}

function signature(nonce, config) {
  return createHmac("sha256", config.key)
    .update("scc-app-access:v1:").update(config.passcode).update(":").update(nonce).digest("base64url");
}

export function hasAppAccess(req) {
  const config = configuration();
  if (!config) return false;
  const cookie = (req.headers.cookie ?? "").split(";").map(value => value.trim())
    .find(value => value.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!cookie || !/^[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{43}$/.test(cookie)) return false;
  const [nonce, provided] = cookie.split(".");
  return timingSafeEqual(Buffer.from(provided), Buffer.from(signature(nonce, config)));
}

function send(req, res, status, body, type = "application/json") {
  res.statusCode = status;
  res.setHeader("Content-Type", `${type}; charset=utf-8`);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Vary", "Cookie");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(req.method === "HEAD" ? undefined : type === "application/json" ? JSON.stringify(body) : body);
}

export function webAccessGate(req, res, next) {
  const pathname = new URL(req.url ?? "/", "http://local").pathname;
  if (pathname === "/healthz" && ["GET", "HEAD"].includes(req.method)) {
    send(req, res, 200, { status: "ok" });
    return;
  }
  // Prevent cached application HTML/files from bypassing a subsequent session.
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Vary", "Cookie");
  if (hasAppAccess(req)) { next(); return; }
  const document = req.headers["sec-fetch-dest"] === "document" ||
    (req.headers.accept ?? "").includes("text/html") || !pathname.split("/").pop()?.includes(".");
  if (["GET", "HEAD"].includes(req.method) && document) {
    send(req, res, 200, gatePage(Boolean(configuration())), "text/html");
  } else {
    send(req, res, 401, { error: "Enter the app passcode to continue.", code: "APP_PASSCODE_REQUIRED" });
  }
}

export function sameOrigin(req) {
  if (req.headers["sec-fetch-site"] === "cross-site") return false;
  if (!req.headers.origin) return true; // Non-browser clients still need the passcode.
  const host = String(req.headers["x-forwarded-host"] ?? req.headers.host).split(",")[0].trim();
  try { return new URL(req.headers.origin).host === host; } catch { return false; }
}

const ROLE_COOKIE = "scc_portal_role";
function readCookie(req, name) {
  return (req.headers.cookie ?? "").split(";").map(value => value.trim())
    .find(value => value.startsWith(`${name}=`))?.slice(name.length + 1);
}
function roleSignature(req, role) {
  const config = configuration();
  return createHmac("sha256", config.key).update("scc-portal-role:v1:")
    .update(readCookie(req, COOKIE) ?? "").update(":").update(role).digest("base64url");
}
export function getPortalRole(req) {
  if (!hasAppAccess(req)) return null;
  const cookie = readCookie(req, ROLE_COOKIE);
  if (!cookie || !/^(applicant|worker)\.[A-Za-z0-9_-]{43}$/.test(cookie)) return null;
  const [role, provided] = cookie.split(".");
  return timingSafeEqual(Buffer.from(provided), Buffer.from(roleSignature(req, role))) ? role : null;
}
export function setPortalRole(req, res, role) {
  if (!hasAppAccess(req) || !sameOrigin(req)) throw new Error("App access required.");
  if (role !== null && !["applicant", "worker"].includes(role)) throw new Error("Invalid portal role.");
  const secure = process.env.NODE_ENV === "production" || req.socket.encrypted ||
    String(req.headers["x-forwarded-proto"] ?? "").split(",")[0].trim() === "https";
  const value = role === null ? "" : `${role}.${roleSignature(req, role)}`;
  res.setHeader("Set-Cookie", `${ROLE_COOKIE}=${value}; Path=/; HttpOnly; SameSite=${secure ? "None; Secure" : "Lax"}${role === null ? "; Max-Age=0" : ""}`);
}

async function unlock(req, res) {
  const config = configuration();
  if (!config) { send(req, res, 503, { error: "App access is not configured. Contact the administrator." }); return; }
  if (!sameOrigin(req) || !String(req.headers["content-type"] ?? "").startsWith("application/json")) {
    send(req, res, 403, { error: "This request is not allowed." }); return;
  }
  const now = Date.now();
  // Use the address appended by the trusted reverse proxy, not a client-supplied
  // first X-Forwarded-For entry. Bound memory and expire failed attempts.
  const ip = String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress).split(",").at(-1).trim();
  for (const [key, entry] of attempts) if (entry.until <= now) attempts.delete(key);
  if (globalFailures.until <= now) globalFailures = { count: 0, until: now + WINDOW };
  const entry = attempts.get(ip) ?? { count: 0, until: now + WINDOW };
  if (entry.count >= 5 || globalFailures.count >= 100 || (!attempts.has(ip) && attempts.size >= 5000)) {
    res.setHeader("Retry-After", String(Math.ceil((entry.count >= 5 ? entry.until - now : globalFailures.until - now) / 1000)));
    send(req, res, 429, { error: "Too many incorrect attempts. Please wait 15 minutes before trying again." }); return;
  }
  let body;
  try {
    let text = "";
    for await (const chunk of req) {
      text += chunk.toString("utf8");
      if (Buffer.byteLength(text) > 512) { send(req, res, 413, { error: "Request is too large." }); return; }
    }
    body = JSON.parse(text);
  } catch { send(req, res, 400, { error: "Enter exactly 4 numeric digits." }); return; }
  if (typeof body?.passcode !== "string" || !/^[0-9]{4}$/.test(body.passcode)) {
    send(req, res, 400, { error: "Enter exactly 4 numeric digits." }); return;
  }
  if (!timingSafeEqual(Buffer.from(body.passcode), Buffer.from(config.passcode))) {
    entry.count++; attempts.set(ip, entry); globalFailures.count++;
    send(req, res, 401, { error: "Incorrect passcode. Please try again." }); return;
  }
  attempts.delete(ip);
  const nonce = randomBytes(32).toString("base64url");
  const secure = process.env.NODE_ENV === "production" || req.socket.encrypted ||
    String(req.headers["x-forwarded-proto"] ?? "").split(",")[0].trim() === "https";
  // No Expires/Max-Age: access lasts for the browser session, not localStorage.
  res.setHeader("Set-Cookie", `${COOKIE}=${nonce}.${signature(nonce, config)}; Path=/; HttpOnly; SameSite=${secure ? "None; Secure" : "Lax"}`);
  send(req, res, 200, { unlocked: true });
}

export async function apiAccessGate(req, res, next) {
  const pathname = new URL(req.url ?? "/", "http://local").pathname;
  if (pathname === "/api/app-access/session" && req.method === "GET") {
    send(req, res, 200, { unlocked: hasAppAccess(req), configured: Boolean(configuration()) }); return;
  }
  if (pathname === "/api/app-access/unlock" && req.method === "POST") {
    await unlock(req, res); return;
  }
  if (pathname === "/api/healthz" && ["GET", "HEAD"].includes(req.method)) { next(); return; }
  if (hasAppAccess(req)) { next(); return; }
  send(req, res, 401, { error: "Enter the app passcode to continue.", code: "APP_PASSCODE_REQUIRED" });
}
