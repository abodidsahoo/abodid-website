const ADMIN_HOME = "/admin/dashboard";
const ADMIN_LOGIN = "/admin/login";

/**
 * Admin sign-in may only return to the global CMS namespace. Product-specific
 * login pages own their own destinations and must not leak into one another.
 */
export const safeAdminReturnTo = (value, fallback = ADMIN_HOME) => {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }

  try {
    const parsed = new URL(value, "https://abodid.com/");
    const isAdminPath = parsed.pathname === "/admin" || parsed.pathname.startsWith("/admin/");
    if (parsed.origin !== "https://abodid.com" || !isAdminPath || parsed.pathname === "/admin/login") {
      return fallback;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
};

export const adminDestinationForRole = (role, requestedPath) =>
  role === "admin" ? safeAdminReturnTo(requestedPath) : null;

export const adminLoginHref = (requestedPath, reason) => {
  const params = new URLSearchParams();
  params.set("next", safeAdminReturnTo(requestedPath));
  if (reason) params.set("reason", reason);
  return `${ADMIN_LOGIN}?${params.toString()}`;
};

