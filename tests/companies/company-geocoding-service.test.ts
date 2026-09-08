import assert from "node:assert/strict";
import test from "node:test";

import { AppError } from "../../src/core/errors/AppError.js";
import { CompanyGeocodingService } from "../../src/modules/companies/services/CompanyGeocodingService.js";

test("geocodes a company address and caches repeated requests", async () => {
  let requestCount = 0;
  const service = new CompanyGeocodingService({
    endpoint: "https://geocoder.test/search",
    minimumIntervalMs: 0,
    fetchImpl: async (input) => {
      requestCount += 1;
      const url = new URL(String(input));
      assert.equal(url.searchParams.get("q"), "Via Roma 1, 20100, Milano, MI, Italia");
      return new Response(JSON.stringify([{ lat: "45.4642035", lon: "9.1899820", display_name: "Via Roma 1, Milano" }]), { status: 200 });
    },
  });

  const address = { address: "Via Roma 1", postalCode: "20100", city: "Milano", province: "MI", country: "Italia" };
  const first = await service.geocode(address);
  const second = await service.geocode(address);

  assert.deepEqual(first, {
    latitude: "45.4642035",
    longitude: "9.1899820",
    displayName: "Via Roma 1, Milano",
    provider: "OpenStreetMap Nominatim",
  });
  assert.deepEqual(second, first);
  assert.equal(requestCount, 1);
});

test("rejects an address that cannot be geocoded", async () => {
  const service = new CompanyGeocodingService({
    endpoint: "https://geocoder.test/search",
    minimumIntervalMs: 0,
    fetchImpl: async () => new Response("[]", { status: 200 }),
  });

  await assert.rejects(
    service.geocode({ address: "Via inesistente", postalCode: "", city: "Milano", province: "", country: "Italia" }),
    (error: unknown) => error instanceof AppError && error.code === "COMPANY_ADDRESS_NOT_FOUND",
  );
});
