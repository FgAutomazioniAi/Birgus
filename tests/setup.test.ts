import assert from "node:assert/strict";
import test from "node:test";
import { nextGarageLayoutVersion, parseEnv, setEnvValues, slug, validCode } from "../scripts/setup.js";

test("setup normalizes names into valid installation codes", () => {
  assert.equal(slug("  Sede Principale S.p.A.  "), "sede-principale-s-p-a");
  assert.equal(slug("Unità Tecnica Nord"), "unita-tecnica-nord");
  assert.equal(validCode("workspace-01"), true);
  assert.equal(validCode("Workspace 01"), false);
  assert.equal(validCode("a"), false);
});

test("setup updates dotenv values without removing comments or custom entries", () => {
  const original = "# Configurazione\nAUTH_PEPPER=CHANGE_ME\nCUSTOM_VALUE=keep\n";
  const updated = setEnvValues(original, new Map([
    ["AUTH_PEPPER", "generated-secret"],
    ["GARAGE_S3_BUCKET", "birgus-files"],
  ]));

  assert.equal(parseEnv(updated).get("AUTH_PEPPER"), "generated-secret");
  assert.equal(parseEnv(updated).get("CUSTOM_VALUE"), "keep");
  assert.equal(parseEnv(updated).get("GARAGE_S3_BUCKET"), "birgus-files");
  assert.match(updated, /^# Configurazione/m);
});

test("setup obtains the Garage version after role changes are staged", () => {
  assert.equal(nextGarageLayoutVersion("Current cluster layout version: 0"), "1");
  assert.equal(nextGarageLayoutVersion("Current cluster layout version: 4"), "5");
  assert.equal(nextGarageLayoutVersion("Staged cluster layout version: 7"), "7");
  assert.equal(nextGarageLayoutVersion("Run garage layout apply --version 9 to enact changes"), "9");
  assert.equal(nextGarageLayoutVersion("No layout version available"), null);
});
