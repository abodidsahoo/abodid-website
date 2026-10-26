import { test, expect } from "@playwright/test";
test.use({
  baseURL: process.env.ARTIST_GLOBE_TEST_URL || "http://localhost:4321",
});
const base = process.env.ARTIST_GLOBE_TEST_URL || "http://localhost:4321",
  route = "/lab/art-in-every-corner";
async function ready(page: import("@playwright/test").Page) {
  await page.goto(route);
  await expect(page.locator(".artist-panel h2")).toBeVisible();
  await expect(page.locator(".globe-loader")).toHaveCount(0, {
    timeout: 25000,
  });
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator("[data-marker]:visible").first()).toBeVisible();
  const dims = await page.locator(".globe-stage").evaluate((el) => ({
    stage: el.clientHeight,
    canvas: el.querySelector("canvas")!.getBoundingClientRect().height,
  }));
  expect(Math.abs(dims.canvas - dims.stage)).toBeLessThan(2);
}
test("starts with a default artist, a permanent card and an in-globe discovery control", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const mapRequests: string[] = [];
  page.on("request", (r) => {
    if (/openfreemap|openmaptiles|maplibre/.test(r.url()))
      mapRequests.push(r.url());
  });
  await ready(page);
  await expect(page.locator("h1")).toHaveText("Art in Every Corner");
  await expect(page.locator(".panel-tools")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Pin", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText(/Great artist \d/)).toHaveCount(0);
  expect(mapRequests).toEqual([]);
  await expect(page.locator(".spotlight-name strong")).toHaveText(
    await page.locator(".artist-panel h2").innerText(),
  );
  const globe = (await page.locator(".globe-workspace").boundingBox())!,
    button = (await page
      .getByRole("button", { name: "Discover an Artist!", exact: true })
      .boundingBox())!,
    panel = (await page.locator(".artist-panel").boundingBox())!;
  expect(globe.width).toBeGreaterThan(globe.height * 1.2);
  expect(panel.x).toBeGreaterThan(globe.x + globe.width);
  expect(
    Math.abs(button.x + button.width / 2 - globe.x - globe.width / 2),
  ).toBeLessThan(2);
  expect(button.y).toBeGreaterThan(globe.y + globe.height - 75);
  expect(button.width).toBeLessThan(220);
  await page.locator("h1").click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".artist-panel h2")).toBeVisible();
});
test("flick keeps rotating with inertia and updates the closest artist spotlight", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await ready(page);
  const canvas = page.locator("canvas"),
    box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.6, {
    steps: 8,
  });
  await page.mouse.up();
  const released = await page.locator(".globe-stage").getAttribute("data-view");
  await page.waitForTimeout(220);
  expect(await page.locator(".globe-stage").getAttribute("data-view")).not.toBe(
    released,
  );
  await expect(page.locator(".spotlight-name strong")).toHaveText(
    await page.locator(".artist-panel h2").innerText(),
  );
  await expect(page.locator(".artist-panel h2")).toBeVisible();
});
test("regional zoom stops at 500 km, reveals labels and zooms back to a smaller globe", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page);
  await page.getByRole("button", { name: "Browse artist index +" }).click();
  await page.getByRole("searchbox").fill("Kyoto");
  await page.locator(".artist-directory li button").click();
  await page.waitForTimeout(100);
  for (let i = 0; i < 22; i++)
    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect
    .poll(async () =>
      Number(
        await page.locator(".globe-stage").getAttribute("data-altitude-km"),
      ),
    )
    .toBeLessThan(501);
  expect(
    Number(await page.locator(".globe-stage").getAttribute("data-altitude-km")),
  ).toBeGreaterThanOrEqual(499.9);
  await expect(
    page.locator(".geo-labels span:not([hidden])").first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Show whole globe" }).click();
  await expect
    .poll(async () =>
      Number(await page.locator(".globe-stage").getAttribute("data-radius")),
    )
    .toBeGreaterThan(4);
  for (let i = 0; i < 10; i++)
    await page.getByRole("button", { name: "Zoom out", exact: true }).click();
  expect(
    Number(await page.locator(".globe-stage").getAttribute("data-radius")),
  ).toBeCloseTo(4.8, 1);
});
test("discovery sweeps through artists before landing in the radar", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await ready(page);
  await page.evaluate(() => {
    const names = new Set<string>();
    (window as any).seenArtistNames = names;
    const node = document.querySelector(".artist-panel h2")!;
    new MutationObserver(() => names.add(node.textContent || "")).observe(
      node,
      { childList: true, subtree: true, characterData: true },
    );
  });
  await page
    .getByRole("button", { name: "Discover an Artist!", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Discovering…" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Discover an Artist!", exact: true }),
  ).toBeEnabled({ timeout: 10000 });
  expect(
    await page.evaluate(() => (window as any).seenArtistNames.size),
  ).toBeGreaterThan(2);
  const metrics = await page.locator(".globe-stage").evaluate((el) => {
    const s = el.getBoundingClientRect(),
      d = el.querySelector('[data-spotlight="true"]')!.getBoundingClientRect();
    return {
      distance: Math.hypot(
        d.x + d.width / 2 - s.x - s.width / 2,
        d.y + d.height / 2 - s.y - s.height / 2,
      ),
    };
  });
  expect(metrics.distance).toBeLessThan(3);
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
      size = await page
        .locator("h1")
        .evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    expect(title.height).toBeLessThan(size * 1.3);
    const globe = (await page.locator(".globe-workspace").boundingBox())!,
      panel = (await page.locator(".artist-panel").boundingBox())!;
    expect(globe.width).toBeGreaterThan(globe.height);
    if (width <= 980) expect(panel.y).toBeGreaterThan(globe.y + globe.height);
    else expect(panel.x).toBeGreaterThan(globe.x + globe.width);
    if (width <= 720) {
      await expect(page.locator(".artist-panel h2")).toBeInViewport();
      const label = (await page.locator(".spotlight-name").boundingBox())!,
        discover = (await page.locator(".discover-button").boundingBox())!;
      expect(label.y + label.height).toBeLessThanOrEqual(discover.y - 2);
    }
    await page.screenshot({
      path: `/tmp/globe-v3-${width}.png`,
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
test("phone pinch changes only globe zoom and ordinary page scrolling remains available", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto(base + route);
  await expect(page.locator(".globe-loader")).toHaveCount(0, {
    timeout: 25000,
  });
  const cdp = await context.newCDPSession(page),
    box = (await page.locator("canvas").boundingBox())!,
    x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  const before = Number(
    await page.locator(".globe-stage").getAttribute("data-altitude-km"),
  );
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: x - 30, y },
      { x: x + 30, y },
    ],
  });
  for (let d = 35; d <= 100; d += 5)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: x - d, y },
        { x: x + d, y },
      ],
    });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect
    .poll(async () =>
      Number(
        await page.locator(".globe-stage").getAttribute("data-altitude-km"),
      ),
    )
    .toBeLessThan(before * 0.8);
  expect(await page.evaluate(() => visualViewport?.scale)).toBe(1);
  await page
    .getByRole("button", { name: "Submit nomination ↗" })
    .scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
  await context.close();
});
test("keyboard rotation and reduced-motion discovery remain usable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page);
  const before = await page.locator(".globe-stage").getAttribute("data-view");
  await page.locator("canvas").focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(() => page.locator(".globe-stage").getAttribute("data-view"))
    .not.toBe(before);
  await page
    .getByRole("button", { name: "Discover an Artist!", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Discover an Artist!", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".artist-panel h2")).toBeVisible();
});
test("WebGL failure leaves the artist index, profile and community forms usable", async ({
  page,
}) => {
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
  await page.goto(route);
  await expect(page.locator(".globe-fallback")).toBeVisible();
  await expect(page.locator(".artist-directory")).toBeVisible();
  await expect(page.locator(".artist-panel h2")).toBeVisible();
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
test("long names and tags reflow in the permanently visible profile", async ({
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
