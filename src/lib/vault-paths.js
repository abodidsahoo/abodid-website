export const VAULT_BASE_PATH = "/obsidian-vault";
export const LEGACY_VAULT_BASE_PATH = "/research/obsidian-vault";

export function vaultPath(suffix = "") {
  const cleanSuffix = String(suffix || "").replace(/^\/+/, "");
  return cleanSuffix ? `${VAULT_BASE_PATH}/${cleanSuffix}` : VAULT_BASE_PATH;
}

export function vaultNoteHref(slug) {
  return vaultPath(encodeURIComponent(String(slug || "")));
}

export function vaultTopicHref(topic) {
  return vaultPath(`topic/${encodeURIComponent(String(topic || ""))}`);
}

export function legacyVaultRedirectLocation(input) {
  const url = input instanceof URL ? input : new URL(String(input), "https://abodid.com");
  const isLegacyVaultPath =
    url.pathname === LEGACY_VAULT_BASE_PATH ||
    url.pathname.startsWith(`${LEGACY_VAULT_BASE_PATH}/`);

  if (!isLegacyVaultPath) return "";

  const suffix = url.pathname.slice(LEGACY_VAULT_BASE_PATH.length);
  const canonicalSuffix = suffix.startsWith("/tag/")
    ? suffix.replace(/^\/tag\//, "/topic/")
    : suffix;
  const destinationPath = `${VAULT_BASE_PATH}${canonicalSuffix}`.replace(/\/$/, "");
  return `${destinationPath}${url.search}`;
}

export function stripVaultNoteHref(href) {
  const path = String(href || "").split(/[?#]/, 1)[0].replace(/\/+$/, "");
  const prefix = `${VAULT_BASE_PATH}/`;
  if (!path.startsWith(prefix)) return "";
  return decodeURIComponent(path.slice(prefix.length));
}
