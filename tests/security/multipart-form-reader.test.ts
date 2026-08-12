import assert from "node:assert/strict";
import { test } from "node:test";

import { MultipartFormReader } from "../../src/shared/http/MultipartFormReader.js";

test("MultipartFormReader sanitizes uploaded file names", async () => {
  const request = {
    async *parts() {
      yield {
        type: "file",
        fieldname: "file",
        filename: "../unsafe/<name>.pdf",
        mimetype: "application/pdf",
        toBuffer: async () => Buffer.from("%PDF-1.7"),
      };
    },
  };

  const payload = await MultipartFormReader.read(request as never);

  assert.equal(payload.files.length, 1);
  assert.equal(payload.files[0]?.fileName, "_name_.pdf");
  assert.equal(payload.files[0]?.mimeType, "application/pdf");
});
