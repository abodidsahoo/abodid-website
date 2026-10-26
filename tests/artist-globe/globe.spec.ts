import { test, expect } from "@playwright/test";
test.use({
  baseURL: process.env.ARTIST_GLOBE_TEST_URL || "http://localhost:4321",
});
const route = "/lab/art-in-every-corner";
async function ready(page: import("@playwright/test").Page) {
  await page.goto(route);
  await expect(page.locator(".globe-loader")).toHaveCount(0, {
    timeout: 25000,
  });
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator("[data-marker]:visible").first()).toBeVisible();
}
test("clean title, markers, independent profile, numbering, pin and search", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await ready(page);
  await expect(page.locator("h1")).toHaveText("Art in Every Corner");
  await expect(
    page.locator(
      ".atlas-intro,.atlas-topline,.space-meta,.atlas-invitation,.desktop-data",
    ),
  ).toHaveCount(0);
  const marker = page.locator("[data-marker]:visible").first();
  await marker.hover();
  await expect(page.locator(".marker-tooltip")).toBeVisible();
  await marker.click();
  await expect(page.locator(".panel-tools .micro")).toHaveText(
    /Great artist \d{3}/,
  );
  const globe = (await page.locator(".globe-workspace").boundingBox())!,
    panel = (await page.locator(".artist-panel").boundingBox())!;
  expect(panel.x).toBeGreaterThan(globe.x + globe.width);
  await page.getByRole("button", { name: "Pin", exact: true }).click();
  await page.locator("h1").click();
  await expect(page.locator(".artist-panel")).toBeVisible();
  await page.getByRole("button", { name: "Unpin", exact: true }).click();
  await page.locator("h1").click();
  await expect(page.locator(".artist-panel")).toHaveCount(0);
  await page.getByRole("button", { name: "Browse artist index +" }).click();
  await page.getByRole("searchbox").fill("Kyoto");
  await page.locator(".artist-directory li button").click();
  await expect(page.locator(".artist-panel h2")).toHaveText("Aya Mori");
  await page.keyboard.press("Escape");
  await expect(page.locator(".artist-panel")).toHaveCount(0);
});
test("discover spins for three seconds and centres the selected artist", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await ready(page);
  const start = Date.now();
  await page
    .getByRole("button", { name: "Discover an Artist!", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Discovering…" }),
  ).toBeDisabled();
  await expect(page.locator(".artist-panel h2")).toBeVisible({ timeout: 8000 });
  expect(Date.now() - start).toBeGreaterThan(2800);
  const selected = (await page
      .locator(".artist-marker.is-selected")
      .boundingBox())!,
    stage = (await page.locator(".globe-stage").boundingBox())!;
  expect(Math.abs(selected.x + 22 - stage.x - stage.width / 2)).toBeLessThan(3);
  expect(Math.abs(selected.y + 22 - stage.y - stage.height / 2)).toBeLessThan(
    3,
  );
});
test("deep zoom has regional detail and resets to a bounded globe", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page);
  await page.getByRole("button", { name: "Browse artist index +" }).click();
  await page.getByRole("searchbox").fill("Kyoto");
  await page.locator(".artist-directory li button").click();
  for (let i = 0; i < 20; i++)
    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect
    .poll(async () =>
      Number(
        await page.locator(".globe-stage").getAttribute("data-altitude-km"),
      ),
    )
    .toBeLessThan(8);
  const altitude = Number(
    await page.locator(".globe-stage").getAttribute("data-altitude-km"),
  );
  expect(altitude).toBeGreaterThanOrEqual(4.8);
  await expect(page.locator(".maplibregl-ctrl-scale")).toBeVisible();
  await page.getByRole("button", { name: "Show whole globe" }).click();
  await expect
    .poll(async () =>
      Number(await page.locator(".globe-stage").getAttribute("data-zoom")),
    )
    .toBeLessThan(2.5);
  for (let i = 0; i < 8; i++)
    await page.getByRole("button", { name: "Zoom out", exact: true }).click();
  expect(
    Number(await page.locator(".globe-stage").getAttribute("data-zoom")),
  ).toBeGreaterThan(0.5);
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
  test(`responsive ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await ready(page);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    const title = (await page.locator("h1").boundingBox())!,
      fontSize = await page
        .locator("h1")
        .evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    expect(title.height).toBeLessThan(fontSize * 1.3);
    const globe = (await page.locator(".globe-workspace").boundingBox())!;
    expect(Math.abs(globe.width - globe.height)).toBeLessThan(2);
    await page.locator("[data-marker]:visible").first().click();
    const panel = (await page.locator(".artist-panel").boundingBox())!,
      afterGlobe = (await page.locator(".globe-workspace").boundingBox())!;
    if (width <= 980)
      expect(panel.y).toBeGreaterThan(afterGlobe.y + afterGlobe.height);
    else expect(panel.x).toBeGreaterThan(afterGlobe.x + afterGlobe.width);
    if (width <= 720) {
      await expect(page.locator(".artist-summary")).toBeInViewport();
      await expect(page.getByText("Scroll for their story ↓")).toBeVisible();
    }
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `/tmp/globe-v2-${width}.png`,
      fullPage: true,
    });
  });
}
test("location autocomplete fills country and submits nomination", async ({
  page,
}) => {
  let submitted: any;
  await page.route("**/api/artist-globe/nominations", (route) => {
    submitted = route.request().postDataJSON();
    return route.fulfill({ json: { success: true } });
  });
  await ready(page);
  await page
    .getByLabel("Artist’s name", { exact: true })
    .fill("Example artist");
  await page
    .getByRole("combobox", { name: "Location (optional)" })
    .fill("Kolkata");
  await page.getByRole("option", { name: "Kolkata India" }).click();
  await expect(page.getByLabel("Country", { exact: true })).toHaveValue("IN");
  expect(await page.locator("#nominee-country option").count()).toBeGreaterThan(
    240,
  );
  await page.getByLabel("Website or social handle").fill("@exampleartist");
  await page.getByRole("button", { name: "Submit nomination ↗" }).click();
  await expect(
    page.getByText("Thank you. Your nomination is saved for review."),
  ).toBeVisible();
  expect(submitted.country).toBe("IN");
  expect(submitted.latitude).toBeCloseTo(22.56, 1);
  expect(submitted.turnstileToken).toBe("local-preview");
});
test("public leaderboard is opt-in and can be left", async ({ page }) => {
  let joined = false;
  await page.route("**/api/artist-globe/wanderers", (route) => {
    if (route.request().method() === "POST") {
      joined = route.request().postDataJSON().action === "join";
      return route.fulfill({ json: { success: true, seconds: 0 } });
    }
    return route.fulfill({
      json: {
        month: "2026-10-01",
        leaders: [],
        award: null,
        mine: joined
          ? {
              display_name: "Atlas Visitor",
              active_seconds: 0,
              public_opt_in: true,
            }
          : null,
      },
    });
  });
  await ready(page);
  await page.getByLabel("Your public name").fill("Atlas Visitor");
  await page.getByRole("button", { name: "Join this month ↗" }).click();
  await expect(
    page.getByRole("button", { name: "Leave leaderboard" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Leave leaderboard" }).click();
  await expect(
    page.getByRole("button", { name: "Join this month ↗" }),
  ).toBeVisible();
});
test("pinch stays inside the map and page scrolling still works", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto(
    (process.env.ARTIST_GLOBE_TEST_URL || "http://localhost:4321") + route,
  );
  await expect(page.locator(".globe-loader")).toHaveCount(0, {
    timeout: 25000,
  });
  const client = await context.newCDPSession(page),
    box = (await page.locator("canvas").boundingBox())!,
    x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  const before = Number(
    await page.locator(".globe-stage").getAttribute("data-zoom"),
  );
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: x - 30, y },
      { x: x + 30, y },
    ],
  });
  for (let d = 35; d <= 100; d += 5)
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: x - d, y },
        { x: x + d, y },
      ],
    });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect
    .poll(async () =>
      Number(await page.locator(".globe-stage").getAttribute("data-zoom")),
    )
    .toBeGreaterThan(before + 0.3);
  expect(await page.evaluate(() => visualViewport?.scale)).toBe(1);
  await page
    .getByRole("button", { name: "Submit nomination ↗" })
    .scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
  await context.close();
});
test("reduced motion and WebGL fallback keep the directory usable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page);
  await page
    .getByRole("button", { name: "Discover an Artist!", exact: true })
    .click();
  await expect(page.locator(".artist-panel h2")).toBeVisible();
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
test("API rejects cross-site nominations and invalid input without saving", async ({
  request,
}) => {
  const cross = await request.post("/api/artist-globe/nominations", {
    headers: { origin: "https://evil.example" },
    data: { name: "Example" },
  });
  expect(cross.status()).toBe(403);
  const invalid = await request.post("/api/artist-globe/nominations", {
    data: { name: "Example", country: "??", link: "javascript:alert(1)" },
  });
  expect(invalid.status()).toBe(400);
});
test("long artist names and tags reflow without image placeholders", async ({
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
  await page.goto(route);
  await expect(page.locator(".globe-loader")).toHaveCount(0, {
    timeout: 25000,
  });
  await expect(page.locator("canvas")).toBeVisible();
  await page
    .getByRole("button", { name: "Discover an Artist!", exact: true })
    .click();
  await expect(page.locator(".artist-panel h2")).toHaveText(artist.name);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await expect(page.locator(".artist-tags span")).toHaveCount(15);
  await expect(page.locator(".artwork-gallery")).toHaveCount(0);
});
