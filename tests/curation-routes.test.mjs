import assert from "node:assert/strict";
import test from "node:test";

import {
  curationPathToInternalPath,
  getCurationCanonicalRedirect,
  getLegacyResourceRedirect,
  legacyResourcePathToCurationPath,
  safeCurationReturnTo,
} from "../src/lib/curationRoutes.js";

test("maps every public legacy route to the curation namespace", () => {
  assert.equal(legacyResourcePathToCurationPath("/resources"), "/");
  assert.equal(legacyResourcePathToCurationPath("/resources/dashboard"), "/dashboard");
  assert.equal(legacyResourcePathToCurationPath("/resources/curator"), "/admin");
  assert.equal(legacyResourcePathToCurationPath("/resources/admin/users"), "/admin/users");
  assert.equal(legacyResourcePathToCurationPath("/resources/u/abodid"), "/u/abodid");
  assert.equal(legacyResourcePathToCurationPath("/resources/abc-123"), "/resource/abc-123");
  assert.equal(legacyResourcePathToCurationPath("/resources/abc-123/edit"), "/resource/abc-123/edit");
});

test("rewrites curation routes to the existing Astro implementation", () => {
  assert.equal(curationPathToInternalPath("/"), "/resources");
  assert.equal(curationPathToInternalPath("/admin"), "/resources/admin");
  assert.equal(curationPathToInternalPath("/resource/abc-123"), "/resources/abc-123");
  assert.equal(curationPathToInternalPath("/resource/abc-123/edit"), "/resources/abc-123/edit");
  assert.equal(curationPathToInternalPath("/not-a-route"), null);
});

test("redirects only the primary host and preserves query strings", () => {
  assert.equal(
    getLegacyResourceRedirect(new URL("https://abodid.com/resources?audience=Designer")),
    "https://curation.abodid.com/?audience=Designer",
  );
  assert.equal(
    getLegacyResourceRedirect(new URL("https://preview.example/resources")),
    null,
  );
});

test("canonicalizes accidental legacy paths on the curation host", () => {
  assert.equal(
    getCurationCanonicalRedirect(new URL("https://curation.abodid.com/resources/example")),
    "https://curation.abodid.com/resource/example",
  );
});

test("keeps authentication return paths same-origin", () => {
  assert.equal(safeCurationReturnTo("/resources/admin/users"), "/admin/users");
  assert.equal(safeCurationReturnTo("/resource/abc?from=email"), "/resource/abc?from=email");
  assert.equal(safeCurationReturnTo("https://evil.example/steal"), "/dashboard");
  assert.equal(safeCurationReturnTo("//evil.example/steal"), "/dashboard");
});
