export const INITIAL_NETWORK_FILTERS = Object.freeze({
  hasEmail: null,
  emailType: "",
  country: "",
  region: "",
  city: "",
  company: "",
  workCategories: Object.freeze([]),
  expertiseKeywords: Object.freeze([]),
  outreachGoals: Object.freeze([]),
  relationshipTier: "",
  tags: Object.freeze([]),
  verificationState: "",
  enrichmentStatus: "",
  newsletterStatus: "",
  doNotContact: null,
  connectedFrom: "",
  connectedTo: "",
  includeArchived: false,
});

const PREFETCH_TTL_MS = 30_000;

let bootstrapRecord = null;

const parseResponse = async (response) => {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(
      new Error(payload.error || `Request failed with ${response.status}.`),
      { payload, status: response.status },
    );
  }
  return payload;
};

export const initialNetworkContactsUrl = () => (
  `/api/admin/network/contacts?query=&filters=${encodeURIComponent(JSON.stringify(INITIAL_NETWORK_FILTERS))}&page=1&pageSize=100&sort=relevance`
);

/**
 * Starts the predictable first-page requests once and shares their result with
 * the Network Intelligence screen. API responses are no-store, so relying on
 * the browser HTTP cache would cause the screen to repeat both requests.
 */
export const prefetchNetworkIntelligence = (
  accessToken,
  { fetchImpl = fetch, now = Date.now() } = {},
) => {
  if (!accessToken) return Promise.reject(new Error("An access token is required."));

  if (
    bootstrapRecord
    && bootstrapRecord.accessToken === accessToken
    && now - bootstrapRecord.startedAt < PREFETCH_TTL_MS
  ) {
    return bootstrapRecord.promise;
  }

  const headers = { Authorization: `Bearer ${accessToken}` };
  const promise = Promise.all([
    fetchImpl(initialNetworkContactsUrl(), { headers }).then(parseResponse),
    fetchImpl("/api/admin/network/facets", { headers }).then(parseResponse),
  ]).then(([contacts, facets]) => ({ contacts, facets }));

  bootstrapRecord = { accessToken, startedAt: now, promise };
  promise.catch(() => {
    if (bootstrapRecord?.promise === promise) bootstrapRecord = null;
  });

  return promise;
};

export const invalidateNetworkIntelligencePrefetch = (accessToken) => {
  if (!accessToken || bootstrapRecord?.accessToken === accessToken) {
    bootstrapRecord = null;
  }
};
