import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  LEGACY_VAULT_BASE_PATH,
  VAULT_BASE_PATH,
  legacyVaultRedirectLocation,
  stripVaultNoteHref,
  vaultNoteHref,
  vaultPath,
  vaultTopicHref,
} from "../../src/lib/vault-paths.js";

test("vault path helpers expose the new canonical base", () => {
  assert.equal(VAULT_BASE_PATH, "/obsidian-vault");
  assert.equal(LEGACY_VAULT_BASE_PATH, "/research/obsidian-vault");
  assert.equal(vaultPath(), "/obsidian-vault");
  assert.equal(vaultPath("directory"), "/obsidian-vault/directory");
});

test("legacy redirect mapping preserves child paths, encoding, and queries", () => {
  assert.equal(
    legacyVaultRedirectLocation("https://abodid.com/research/obsidian-vault"),
    "/obsidian-vault",
  );
  assert.equal(
    legacyVaultRedirectLocation(
      "https://abodid.com/research/obsidian-vault/a%20note?fromVaultSearch=1",
    ),
    "/obsidian-vault/a%20note?fromVaultSearch=1",
  );
  assert.equal(
    legacyVaultRedirectLocation("https://abodid.com/research/obsidian-vaultish"),
    "",
  );
  assert.equal(
    legacyVaultRedirectLocation("https://abodid.com/research/obsidian-vault/tag/visual%20culture"),
    "/obsidian-vault/topic/visual%20culture",
  );
  assert.equal(
    legacyVaultRedirectLocation("https://abodid.com/research/obsidian-vault/"),
    "/obsidian-vault",
  );
});

test("note and topic helpers preserve encoded public slugs", () => {
  assert.equal(vaultNoteHref("memory & ritual"), "/obsidian-vault/memory%20%26%20ritual");
  assert.equal(vaultTopicHref("visual culture"), "/obsidian-vault/topic/visual%20culture");
  assert.equal(stripVaultNoteHref("/obsidian-vault/memory%20%26%20ritual?fromVaultSearch=1"), "memory & ritual");
  assert.equal(stripVaultNoteHref("/research/obsidian-vault/memory"), "");
});

test("Vercel permanently redirects the legacy root and every legacy child path", () => {
  const config = JSON.parse(
    fs.readFileSync(new URL("../../vercel.json", import.meta.url), "utf8"),
  );
  assert.deepEqual(config.redirects?.slice(0, 3), [
    {
      source: "/research/obsidian-vault/tag/:path*",
      destination: "/obsidian-vault/topic/:path*",
      permanent: true,
    },
    {
      source: "/research/obsidian-vault",
      destination: "/obsidian-vault",
      permanent: true,
    },
    {
      source: "/research/obsidian-vault/:path*",
      destination: "/obsidian-vault/:path*",
      permanent: true,
    },
  ]);
});
