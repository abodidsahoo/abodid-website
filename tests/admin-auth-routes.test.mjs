import assert from "node:assert/strict";
import test from "node:test";

import {
  adminDestinationForRole,
  adminLoginHref,
  safeAdminReturnTo,
} from "../src/lib/adminAuthRoutes.js";

test("admin login returns only to the global admin namespace", () => {
  assert.equal(safeAdminReturnTo("/admin/dashboard?section=users"), "/admin/dashboard?section=users");
  assert.equal(safeAdminReturnTo("/resources/dashboard"), "/admin/dashboard");
  assert.equal(safeAdminReturnTo("/opportunities/example"), "/admin/dashboard");
  assert.equal(safeAdminReturnTo("//evil.example/admin"), "/admin/dashboard");
  assert.equal(safeAdminReturnTo("https://evil.example/admin"), "/admin/dashboard");
  assert.equal(safeAdminReturnTo("/admin/login"), "/admin/dashboard");
});

test("only an administrator receives an admin destination", () => {
  assert.equal(adminDestinationForRole("admin", "/admin/editor"), "/admin/editor");
  assert.equal(adminDestinationForRole("curator", "/admin/dashboard"), null);
  assert.equal(adminDestinationForRole("user", "/admin/dashboard"), null);
  assert.equal(adminDestinationForRole(null, "/admin/dashboard"), null);
});

test("admin login links preserve only a safe Creator Studio destination", () => {
  assert.equal(
    adminLoginHref("/admin/dashboard?section=analytics", "access_denied"),
    "/admin/login?next=%2Fadmin%2Fdashboard%3Fsection%3Danalytics&reason=access_denied",
  );
  assert.equal(
    adminLoginHref("https://evil.example/admin", "no_session"),
    "/admin/login?next=%2Fadmin%2Fdashboard&reason=no_session",
  );
});
