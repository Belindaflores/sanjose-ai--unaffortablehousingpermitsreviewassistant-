import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomBytes, randomInt } from "node:crypto";
import { apiAccessGate, getPortalRole, setPortalRole } from "./index.mjs";

test("portal selection is server signed, passcode bound, and browser-session scoped", async t => {
  process.env.APP_PASSCODE = String(randomInt(10000)).padStart(4, "0");
  process.env.SESSION_SECRET = randomBytes(32).toString("hex");
  const server = createServer((req, res) => {
    void apiAccessGate(req, res, () => {
      if (req.url === "/api/select") setPortalRole(req, res, "applicant");
      if (req.url === "/api/exit") setPortalRole(req, res, null);
      res.end(JSON.stringify({ role: getPortalRole(req) }));
    });
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const unlock = () => fetch(base + "/api/app-access/unlock", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passcode: process.env.APP_PASSCODE }),
  });
  const request = (path, cookie) => fetch(base + path, { headers: { cookie } });
  assert.equal((await fetch(base + "/api/select")).status, 401);
  const access = (await unlock()).headers.get("set-cookie").split(";")[0];
  const selected = await request("/api/select", access);
  const roleCookie = selected.headers.get("set-cookie");
  assert.match(roleCookie, /HttpOnly/);
  assert.doesNotMatch(roleCookie, /Expires=|Max-Age=/);
  const role = roleCookie.split(";")[0];
  const combined = `${access}; ${role}`;
  assert.equal((await (await request("/api/profile", combined)).json()).role, "applicant");
  assert.equal((await (await request("/api/profile", combined.replace("applicant.", "worker."))).json()).role, null);
  assert.equal((await (await request("/api/profile", access)).json()).role, null);
  assert.equal((await request("/api/profile", role)).status, 401);
  const anotherAccess = (await unlock()).headers.get("set-cookie").split(";")[0];
  assert.equal((await (await request("/api/profile", `${anotherAccess}; ${role}`)).json()).role, null);
  const exited = await request("/api/exit", combined);
  assert.match(exited.headers.get("set-cookie"), /Max-Age=0/);
  assert.equal((await request("/api/profile", access)).status, 200);
});
