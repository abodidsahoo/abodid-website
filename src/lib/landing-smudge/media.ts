export const smudgeMotionQuery =
  "(any-hover: hover) and (any-pointer: fine) and (prefers-reduced-motion: no-preference)";

function isCloudflareMedia(url: URL) {
  return url.origin === "https://assets.abodid.com" && /^\/(photos|videos)\//.test(url.pathname);
}

export function canUseSmudgeMedia(source: string) {
  const url = new URL(source, location.href);
  return url.origin === location.origin || isCloudflareMedia(url);
}

export function smudgeMediaUrl(source: string) {
  const url = new URL(source, location.href);
  if (import.meta.env.DEV && isCloudflareMedia(url)) {
    return `/__landing-smudge-media${url.pathname}${url.search}`;
  }
  return source;
}
