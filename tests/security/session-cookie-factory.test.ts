import assert from "node:assert/strict";
import { test } from "node:test";

import { SessionCookieFactory } from "../../src/shared/http/SessionCookieFactory.js";

test("SessionCookieFactory always marks session cookies as HttpOnly", () => {
  const cookie = new SessionCookieFactory({ cookieName: "birgus_session" }).createSessionCookie("token-value", 3600);

  assert.match(cookie, /birgus_session=token-value/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Max-Age=3600/);
});

test("SessionCookieFactory includes Secure only when explicitly configured", () => {
  const insecureCookie = new SessionCookieFactory({ secure: false }).createSessionCookie("token-value", 3600);
  const secureCookie = new SessionCookieFactory({ secure: true }).createSessionCookie("token-value", 3600);

  assert.doesNotMatch(insecureCookie, /;\s*Secure/);
  assert.match(secureCookie, /;\s*Secure/);
});
