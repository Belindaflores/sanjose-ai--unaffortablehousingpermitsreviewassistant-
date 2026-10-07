import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomInt, randomBytes } from "node:crypto";
import { apiAccessGate, webAccessGate } from "./index.mjs";

// Disposable random test credentials; never inspect the real project secrets.
const code = String(randomInt(10000)).padStart(4, "0");
process.env.APP_PASSCODE = code;
process.env.SESSION_SECRET = randomBytes(32).toString("hex");

test("passcode enforced on the server, with browser-session cookies and no bypasses", async t => {
  const server = createServer((req, res) => {
    const next = () => { res.end("protected"); };
    if (req.url.startsWith("/api")) void apiAccessGate(req, res, next);
    else webAccessGate(req, res, next);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = (path, cookie) => fetch(base + path, { headers: cookie ? { cookie } : {} });
  const post = (value, headers = {}) => fetch(base + "/api/app-access/unlock", {
    method: "POST", headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ passcode: value }),
  });

  for (const path of ["/api/permit-applications", "/api/county-public-records", "/api/saved-applications", "/api/permit-rule-config", "/api/portal-user", "/api/__clerk/v1/client", "/assets/App.js", "/sample-documents/example.pdf", "/src/App.tsx"]) {
    assert.equal((await get(path)).status, 401, path);
  }
  const page = await (await get("/records")).text();
  assert.match(page, /4-digit passcode/);
  assert.ok(!page.includes(code), "the configured passcode must not appear in HTML");
  assert.ok(!page.includes("src/App"), "the locked page must not load the application");
  for (const invalid of ["", "12", "12345", "abcd", 1234]) assert.equal((await post(invalid)).status, 400);
  assert.equal((await post(code, { Origin: "https://attacker.invalid" })).status, 403);
  const wrong = String((Number(code) + 1) % 10000).padStart(4, "0");
  const denied = await post(wrong);
  assert.equal(denied.status, 401);
  assert.match((await denied.json()).error, /Incorrect passcode/);
  assert.equal(denied.headers.get("set-cookie"), null);
  const accepted = await post(code, { "X-Forwarded-Proto": "https" });
  assert.equal(accepted.status, 200);
  const setCookie = accepted.headers.get("set-cookie");
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /Secure/);
  assert.match(setCookie, /SameSite=None/);
  assert.doesNotMatch(setCookie, /Expires=|Max-Age=/i);
  const cookie = setCookie.split(";")[0];
  assert.equal(await (await get("/records", cookie)).text(), "protected");
  assert.equal(await (await get("/api/permit-applications", cookie)).text(), "protected");
  assert.equal((await (await get("/api/app-access/session", cookie)).json()).unlocked, true);
  assert.equal((await get("/api/permit-applications", cookie + "x")).status, 401);
  assert.equal((await get("/api/permit-applications")).status, 401, "fresh browser session is locked");
  process.env.APP_PASSCODE = wrong;
  assert.equal((await get("/api/permit-applications", cookie)).status, 401, "secret rotation revokes access");
  process.env.APP_PASSCODE = "invalid";
  assert.equal((await post(code)).status, 503);
  assert.equal((await get("/api/permit-applications", cookie)).status, 401);
  process.env.APP_PASSCODE = code;
  // Leading zeros are accepted, including a new valid secret configuration.
  process.env.APP_PASSCODE = "0" + String(randomInt(1000)).padStart(3, "0");
  assert.equal((await post(process.env.APP_PASSCODE)).status, 200);
  process.env.APP_PASSCODE = code;
  for (let i = 0; i < 5; i++) {
    assert.equal((await post(wrong, { "X-Forwarded-For": "192.0.2.10" })).status, 401);
  }
  const throttled = await post(wrong, { "X-Forwarded-For": "192.0.2.10" });
  assert.equal(throttled.status, 429);
  assert.ok(Number(throttled.headers.get("retry-after")) > 0);
  delete process.env.APP_PASSCODE;
  assert.equal((await post(code)).status, 503, "missing secret fails closed");
});
