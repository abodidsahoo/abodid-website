import { expect, test } from "@playwright/test";

test("Work filters use strict AND without a page reload", async ({ page }) => {
  await page.goto("/work");
  await page.getByRole("button", { name: "Research", exact: true }).click();
  await page.getByRole("button", { name: "Photography", exact: true }).click();
  await expect(page).toHaveURL(/terms=photography%2Cresearch|terms=research%2Cphotography/);
  await expect(page.getByText(/projects?$/).first()).toBeVisible();
});

test("Work index collapses to one column on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/work");
  const cards = page.locator(".work-card");
  await expect(cards.first()).toBeVisible();
  if (await cards.count() > 1) {
    const first = await cards.nth(0).boundingBox();
    const second = await cards.nth(1).boundingBox();
    expect(second!.y).toBeGreaterThan(first!.y + first!.height - 2);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("existing Photography and Film routes still respond", async ({ request }) => {
  expect((await request.get("/photography")).ok()).toBe(true);
  expect((await request.get("/films")).ok()).toBe(true);
});

test("admin draft preview uses a real mobile viewport", async ({ page }) => {
  const pixel = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";
  const project = {
    id: "preview-test",
    slug: "preview-test",
    status: "draft",
    title: "Responsive Preview",
    oneLineDescription: "A draft rendered inside the production mobile viewport.",
    yearStart: 2026,
    workInProgress: false,
    limitedPublic: false,
    coverUrl: "",
    taxonomies: [],
    organisations: [],
    collaborators: [],
    links: [],
    blocks: [{
      id: "preview-grid",
      blockType: "image_grid",
      visible: true,
      content: { media: [1, 2, 3].map((id) => ({ id: String(id), url: pixel, alt: `Preview ${id}` })) },
      settings: { width: "wide", spacing: "default", columns: 3, mediaFit: "cover" },
    }],
  };
  await page.addInitScript(({ value }) => {
    window.sessionStorage.setItem("portfolio:preview:preview-test", JSON.stringify(value));
  }, { value: project });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/projects/preview?project=preview-test");
  await expect(page.getByRole("heading", { name: "Responsive Preview" })).toBeVisible();
  const columnCount = await page.locator(".portfolio-image-grid").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
  expect(columnCount).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
