import assert from "node:assert/strict";
import test from "node:test";

import {
  initialNetworkContactsUrl,
  invalidateNetworkIntelligencePrefetch,
  prefetchNetworkIntelligence,
} from "../../src/lib/network/prefetch.js";

const response = (payload, { ok = true, status = 200 } = {}) => ({
  ok,
  status,
  json: async () => payload,
});

test("prefetches the initial contacts and facets once for concurrent consumers", async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    return response(url.includes("facets") ? { total: 10_047 } : { contacts: [{ id: "one" }] });
  };

  invalidateNetworkIntelligencePrefetch();
  const first = prefetchNetworkIntelligence("token-one", { fetchImpl, now: 1_000 });
  const second = prefetchNetworkIntelligence("token-one", { fetchImpl, now: 1_001 });
  const [firstResult, secondResult] = await Promise.all([first, second]);

  assert.strictEqual(first, second);
  assert.deepEqual(firstResult, secondResult);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].url, initialNetworkContactsUrl());
  assert.equal(requests[1].url, "/api/admin/network/facets");
  assert.equal(requests[0].options.headers.Authorization, "Bearer token-one");
});

test("invalidating the prefetch causes the next visit to load fresh data", async () => {
  let requestCount = 0;
  const fetchImpl = async (url) => {
    requestCount += 1;
    return response(url.includes("facets") ? { total: requestCount } : { contacts: [] });
  };

  invalidateNetworkIntelligencePrefetch();
  await prefetchNetworkIntelligence("token-two", { fetchImpl, now: 2_000 });
  invalidateNetworkIntelligencePrefetch("token-two");
  await prefetchNetworkIntelligence("token-two", { fetchImpl, now: 2_001 });

  assert.equal(requestCount, 4);
});

test("a failed prefetch is cleared so a later request can retry", async () => {
  let requestCount = 0;
  const fetchImpl = async () => {
    requestCount += 1;
    return requestCount <= 2
      ? response({ error: "Temporary failure" }, { ok: false, status: 503 })
      : response({});
  };

  invalidateNetworkIntelligencePrefetch();
  await assert.rejects(
    prefetchNetworkIntelligence("token-three", { fetchImpl, now: 3_000 }),
    /Temporary failure/,
  );
  await prefetchNetworkIntelligence("token-three", { fetchImpl, now: 3_001 });

  assert.equal(requestCount, 4);
});
