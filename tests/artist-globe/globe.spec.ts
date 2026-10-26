import { test, expect } from "@playwright/test";
const route = "/lab/art-in-every-corner";
async function ready(page: import("@playwright/test").Page) {
  await page.goto(route);
  await expect(page.locator(".globe-loader")).toHaveCount(0, {
    timeout: 20000,
  });
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator("[data-marker]:visible").first()).toBeVisible();
}
test("marker tooltip, selection, pinning, switching, dismissal and directory", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await ready(page);
  await page.getByRole("button", { name: "Auto rotate", exact: true }).click();
  const marker = page.locator("[data-marker]:visible").first();
  const markerBox = (await marker.boundingBox())!;
  await page.mouse.move(markerBox.x + 22, markerBox.y + 22);
  await expect(page.locator(".marker-tooltip")).toBeVisible();
  await page.mouse.click(markerBox.x + 22, markerBox.y + 22);
  await expect(page.locator(".artist-panel h2")).toBeVisible();
  await expect(
    page.getByText("Fictional demo artist", { exact: true }),
  ).toBeVisible();
  const width = await page
    .locator(".globe-stage")
    .evaluate((e) => e.clientWidth);
  await page.getByRole("button", { name: "Pin", exact: true }).click();
  await page.waitForTimeout(500);
  expect(
    await page.locator(".globe-stage").evaluate((e) => e.clientWidth),
  ).toBeLessThan(width);
  await page.locator("canvas").click({ position: { x: 20, y: 100 } });
  await expect(page.locator(".artist-panel")).toBeVisible();
  await page.getByRole("button", { name: "Unpin", exact: true }).click();
  await page.locator("canvas").click({ position: { x: 20, y: 100 } });
  await expect(page.locator(".artist-panel")).toHaveCount(0);
  await page.getByRole("button", { name: "Browse artist index +" }).click();
  await page.getByRole("searchbox").fill("Kyoto");
  await expect(page.locator(".artist-directory li")).toHaveCount(1);
  await page.locator(".artist-directory li button").click();
  await expect(page.locator(".artist-panel h2")).toHaveText("Aya Mori");
  await page.keyboard.press("Escape");
  await expect(page.locator(".artist-panel")).toHaveCount(0);
});
test("rotation, bounded wheel zoom and keyboard remain usable", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("button", { name: "Auto rotate", exact: true }).click();
  const canvas = page.locator("canvas");
  const box = (await canvas.boundingBox())!;
  const before = await page
    .locator("[data-marker]:visible")
    .first()
    .getAttribute("style");
  await canvas.focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(500);
  expect(
    await page.locator("[data-marker]:visible").first().getAttribute("style"),
  ).not.toBe(before);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.6, {
    steps: 12,
  });
  await page.mouse.up();
  await page.mouse.wheel(0, -50000);
  await page.waitForTimeout(400);
  await expect(canvas).toBeVisible();
  await page.mouse.wheel(0, 50000);
  await page.waitForTimeout(400);
  await expect(page.locator("[data-marker]:visible").first()).toBeVisible();
  await expect(page.locator(".globe-fallback")).toHaveCount(0);
});
for (const [width, height] of [
  [1440, 900],
  [1024, 768],
  [981, 800],
  [979, 800],
  [768, 1024],
  [721, 900],
  [719, 900],
  [390, 844],
  [320, 568],
]) {
  test(`responsive composition ${width}x${height}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width, height });
    await ready(page);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await page.locator("[data-marker]:visible").first().click();
    await expect(page.locator(".artist-summary")).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    const stage = (await page.locator(".globe-workspace").boundingBox())!;
    const panel = (await page.locator(".artist-panel").boundingBox())!;
    if (width <= 720) {
      expect(panel.y).toBeGreaterThanOrEqual(stage.y + stage.height - 1);
      await expect(page.getByText("Scroll for their story ↓")).toBeVisible();
    }
    const footer = (await page.locator("footer").boundingBox())!;
    expect(footer.y).toBeGreaterThanOrEqual(panel.y + panel.height - 1);
    await page.screenshot({
      path: `/tmp/artist-globe-${width}.png`,
      fullPage: true,
    });
  });
}
test("reduced motion and missing WebGL have functional alternatives", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page);
  await expect(
    page.getByRole("button", { name: "Auto rotate", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: any[]
    ) {
      if (type.startsWith("webgl")) return null;
      return original.apply(this, [type, ...args] as any);
    } as any;
  });
  await page.reload();
  await expect(page.locator(".globe-fallback")).toBeVisible();
  await expect(page.locator(".artist-directory")).toBeVisible();
});
test("phone touch rotation, two-finger pinch and page scrolling", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await ready(page);
  const client = await context.newCDPSession(page);
  const box = (await page.locator("canvas").boundingBox())!;
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  const before = await page
    .locator("[data-marker]:visible")
    .first()
    .getAttribute("style");
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: x + 70, y: y + 15 }],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.waitForTimeout(100);
  expect(
    await page.locator("[data-marker]:visible").first().getAttribute("style"),
  ).not.toBe(before);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: x - 35, y },
      { x: x + 35, y },
    ],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { x: x - 85, y },
      { x: x + 85, y },
    ],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.locator("[data-marker]:visible").first().tap();
  await expect(page.locator(".artist-summary")).toBeVisible();
  await page.locator(".artist-story").scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
  await expect(page.locator(".globe-fallback")).toHaveCount(0);
  await context.close();
});
test("long profile content reflows with no artwork placeholders", async ({
  page,
}) => {
  const { demoArtists } = await import("../../src/lib/artist-globe/data");
  const artist = {
    ...demoArtists[0],
    name: "A very long independent multidisciplinary artist name with several words",
    tags: Array.from(
      { length: 15 },
      (_, i) => `Material and place study ${i + 1}`,
    ),
  };
  await page.route("**/api/artist-globe/artists", (route) =>
    route.fulfill({ json: { artists: [artist], mode: "demo" } }),
  );
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page);
  await page.getByRole("button", { name: "Browse artist index +" }).click();
  await page.locator(".artist-directory li button").click();
  await expect(page.locator(".artist-panel h2")).toHaveText(artist.name);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await expect(page.locator(".artwork-gallery")).toHaveCount(0);
  await expect(page.locator(".artist-tags span")).toHaveCount(15);
});
