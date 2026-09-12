import assert from "node:assert/strict";
import test from "node:test";

import {
  curationPath,
  curationPathToInternalPath,
  getCurationCanonicalRedirect,
  getCurationSubdomainRedirect,
  getLegacyResourceRedirect,
  legacyResourcePathToCurationPath,
  safeCurationReturnTo,
} from "../src/lib/curationRoutes.js";

test("maps paths to the unified /resources namespace", () => {
  assert.equal(legacyResourcePathToCurationPath("/resources"), "/resources");
  assert.equal(legacyResourcePathToCurationPath("/resources/dashboard"), "/resources/dashboard");
  assert.equal(legacyResourcePathToCurationPath("/resources/curator"), "/resources/admin");
  assert.equal(legacyResourcePathToCurationPath("/resources/admin/users"), "/resources/admin/users");
  assert.equal(legacyResourcePathToCurationPath("/resources/u/abodid"), "/resources/u/abodid");
  assert.equal(legacyResourcePathToCurationPath("/resources/abc-123"), "/resources/abc-123");
  assert.equal(legacyResourcePathToCurationPath("/resources/abc-123/edit"), "/resources/abc-123/edit");
  assert.equal(legacyResourcePathToCurationPath("/dashboard"), "/resources/dashboard");
  assert.equal(legacyResourcePathToCurationPath("/submit"), "/resources/submit");
  assert.equal(legacyResourcePathToCurationPath("/saved"), "/resources/saved");
});

test("resolves internal Astro implementation routes", () => {
  assert.equal(curationPathToInternalPath("/resources"), "/resources");
  assert.equal(curationPathToInternalPath("/resources/admin"), "/resources/admin");
  assert.equal(curationPathToInternalPath("/resources/abc-123"), "/resources/abc-123");
  assert.equal(curationPathToInternalPath("/resources/abc-123/edit"), "/resources/abc-123/edit");
  assert.equal(curationPathToInternalPath("/resources/dashboard"), "/resources/dashboard");
});

test("never redirects away from primary host resources routes", () => {
  assert.equal(getLegacyResourceRedirect(), null);
});

test("redirects curation subdomain requests to primary site /resources routes", () => {
  assert.equal(
    getCurationCanonicalRedirect(new URL("https://curation.abodid.com/")),
    "https://abodid.com/resources",
  );
  assert.equal(
    getCurationCanonicalRedirect(new URL("https://curation.abodid.com/resources/example")),
    "https://abodid.com/resources/example",
  );
  assert.equal(
    getCurationCanonicalRedirect(new URL("https://curation.abodid.com/dashboard")),
    "https://abodid.com/resources/dashboard",
  );
  assert.equal(
    getCurationCanonicalRedirect(new URL("https://curation.abodid.com/resource/123")),
    "https://abodid.com/resources/123",
  );
});

test("keeps authentication return paths safe and internal", () => {
  assert.equal(safeCurationReturnTo("/resources/admin/users"), "/resources/admin/users");
  assert.equal(safeCurationReturnTo("/resources/123?from=email"), "/resources/123?from=email");
  assert.equal(safeCurationReturnTo("https://evil.example/steal"), "/resources/dashboard");
  assert.equal(safeCurationReturnTo("//evil.example/steal"), "/resources/dashboard");
});


