import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
const candidates = JSON.parse(
  readFileSync(
    new URL(
      "../../src/data/artist-globe/research-candidates.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
import { demoArtists } from "../../src/lib/artist-globe/data";
const route = "/lab/art-in-every-corner";
let previewCandidates: typeof candidates;
test.beforeAll(async ({ request }) => {
  const response = await request.get("/api/artist-globe/artists");
  previewCandidates = (await response.json()).artists;
});
test.use({
  baseURL: process.env.ARTIST_GLOBE_TEST_URL || "http://localhost:4321",
});
async function ready(page: Page, records: unknown[] = previewCandidates) {
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.route("**/api/artist-globe/artists", (r) =>
    r.fulfill({ json: { artists: records, mode: "research-preview" } }),
  );
  await page.goto(route);
  await expect(page.locator(".globe-loader")).toHaveCount(0, {
    timeout: 25000,
  });
  await expect(page.locator(".globe-stage canvas")).toBeVisible();
  await expect(page.locator(".artist-panel h2")).not.toHaveText(
    "Finding a corner…",
  );
  await expect
    .poll(() => page.locator(".globe-stage").getAttribute("data-view"))
    .not.toBeNull();
}
async function openIndex(page: Page) {
  const summary = page.getByLabel("Globe menu", { exact: true });
  if (!(await page.locator(".globe-menu").getAttribute("open"))) {
    if (
      !(await page
        .locator(".globe-menu")
        .evaluate((el) => el.hasAttribute("open")))
    )
      await summary.click();
  }
  await page
    .getByRole("button", { name: "Artist index", exact: false })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
}
const view = async (page: Page) =>
  (await page.locator(".globe-stage").getAttribute("data-view"))!
    .split(",")
    .map(Number);
const angle = (a: number[], b: number[]) =>
  Math.acos(
    Math.max(
      -1,
      Math.min(
        1,
        a.reduce((s, n, i) => s + n * b[i], 0),
      ),
    ),
  );

test("local API exposes the imported preview without invented pins", async ({
  request,
}) => {
  const response = await request.get("/api/artist-globe/artists");
  expect(response.ok()).toBe(true);
  const { artists, mode } = await response.json();
  expect(mode).toBe("research-preview");
  expect(artists).toHaveLength(216);
  expect(artists.filter((a: any) => a.map_pin_ready)).toHaveLength(28);
  expect(artists.filter((a: any) => a.source_latitude === null)).toHaveLength(
    152,
  );
  expect(artists.every((a: any) => !a.is_demo)).toBe(true);
});
test("clean profile prioritizes place, removes placeholder sections, and keeps source links", async ({
  page,
}) => {
  await ready(page);
  await expect(page.locator("h1")).toHaveText("Art in Every Corner");
  await expect(page.locator("[data-marker]")).toHaveCount(216);
  await expect(
    page.locator(".artist-tags,blockquote,.atlas-community,.atlas-footer"),
  ).toHaveCount(0);
  await expect(
    page.getByText("Nominate an artist", { exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".artist-location")).toContainText(
    previewCandidates[0].country,
  );
  const order = await page
    .locator(".artist-summary")
    .evaluate((el) => Array.from(el.children).map((c) => c.className));
  expect(order.indexOf("artist-location")).toBeGreaterThan(0);
  await expect(page.locator(".artist-story")).not.toContainText(
    "Documented as a participating artist",
  );
  await expect(page.locator(".artist-practice")).toHaveCount(0);
  expect(
    await page
      .locator(".artist-links")
      .evaluate((el) => getComputedStyle(el).borderTopWidth),
  ).toBe("0px");
  await expect(page.locator(".country-flag")).toHaveAttribute("src", /\.png$/);
  expect(
    await page
      .locator(".country-flag")
      .evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0),
  ).toBe(true);
  await expect(page.locator(".artist-google-search")).toHaveAttribute(
    "target",
    "_blank",
  );
  const external = page.locator(".artist-links a");
  for (let i = 0; i < (await external.count()); i++)
    expect(await external.nth(i).getAttribute("href")).toMatch(
      /^(https:\/\/|mailto:)/,
    );
});
for (const [width, height] of [
  [1920, 1080],
  [1440, 900],
  [1366, 768],
  [1280, 720],
  [1024, 768],
  [1024, 600],
  [768, 1024],
  [390, 844],
  [320, 568],
]) {
  test(`layout ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await ready(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const globe = (await page.locator(".globe-workspace").boundingBox())!,
      card = (await page.locator(".artist-panel").boundingBox())!;
    if (width > 900) {
      expect(
        await page.evaluate(
          () => document.documentElement.scrollHeight <= innerHeight,
        ),
      ).toBe(true);
      expect(Math.abs(globe.height - card.height)).toBeLessThan(2);
      expect(card.x).toBeGreaterThan(globe.x + globe.width);
      const button = (await page.locator(".discovery-die").boundingBox())!;
      expect(button.x).toBeGreaterThan(globe.x + globe.width * 0.6);
      expect(button.width).toBe(112);
      expect(button.x + button.width).toBeLessThan(globe.x + globe.width);
    } else expect(card.y).toBeGreaterThan(globe.y + globe.height);
    const counters = (await page.locator(".globe-coordinates").boundingBox())!,
      clock = (await page.locator(".atlas-readout").boundingBox())!,
      discovery = (await page.locator(".discovery-die").boundingBox())!;
    expect(counters.x).toBeGreaterThan(clock.x + clock.width + 2);
    expect(discovery.y).toBeGreaterThan(counters.y + counters.height + 2);
    expect(
      Math.abs(
        counters.x + counters.width / 2 - discovery.x - discovery.width / 2,
      ),
    ).toBeLessThan(3);
    const flag = (await page.locator(".country-flag").boundingBox())!,
      menu = (await page
        .getByLabel("Globe menu", { exact: true })
        .boundingBox())!;
    expect(flag.y).toBeGreaterThan(menu.y + menu.height);
    expect(counters.y).toBeGreaterThan(flag.y + flag.height + 6);
    expect(
      Math.abs(counters.x + counters.width - flag.x - flag.width),
    ).toBeLessThan(2);
    expect(flag.y + flag.height).toBeLessThan(discovery.y);
    expect(flag.width).toBe(80);
    await expect(page.locator(".radar-orbit")).toBeVisible();
    await page.screenshot({
      path: `/tmp/atlas-v5-${width}-${height}.png`,
      fullPage: true,
    });
  });
}
test("country beneath the crosshair always wins label collisions in the UK", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page, [demoArtists[1], demoArtists[0]]);
  await expect(page.locator(".globe-stage")).toHaveAttribute(
    "data-central-country",
    "United Kingdom",
  );
  await expect(page.locator('.country[data-central="true"]')).toHaveText(
    "United Kingdom",
  );
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(page.locator('.country[data-central="true"]')).toHaveText(
    "United Kingdom",
  );
});
test("label switches work independently and the widest overview shows only dots", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page);
  await expect(page.locator(".country").first()).toBeVisible();
  await page.getByLabel("Globe menu", { exact: true }).click();
  await page.getByLabel("Show country names", { exact: true }).uncheck();
  await expect(page.locator(".country")).toHaveCount(0);
  for (let i = 0; i < 5; i++)
    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(
    page.locator(".geo-labels .city,.geo-labels .region").first(),
  ).toBeVisible();
  await page.getByLabel("Show city & place names", { exact: true }).uncheck();
  await expect(page.locator(".geo-labels span")).toHaveCount(0);
  await page.getByLabel("Show country names", { exact: true }).check();
  await expect(page.locator(".country").first()).toBeVisible();
  await expect
    .poll(async () =>
      Number(await page.locator(".globe-stage").getAttribute("data-radius")),
    )
    .toBeCloseTo(2.13, 3);
  for (let i = 0; i < 10; i++)
    await page.getByRole("button", { name: "Zoom out", exact: true }).click();
  await expect(page.locator(".geo-labels span")).toHaveCount(0);
  await expect(page.locator("[data-marker]:visible").first()).toBeVisible();
});
test("index is a modal with instant fuzzy search, scrolling and focus containment", async ({
  page,
}) => {
  await ready(page);
  await openIndex(page);
  await expect(page.getByRole("searchbox")).toBeFocused();
  await expect(page.locator(".artist-directory li")).toHaveCount(216);
  const input = page.getByRole("searchbox");
  await input.fill("balsca");
  await expect(page.locator(".index-name").first()).toContainText(
    "Adrián Balseca",
  );
  await input.fill("Jappan");
  await expect(page.locator(".index-location").first()).toContainText("Japan");
  await input.fill("photography");
  expect(await page.locator(".artist-directory li").count()).toBeGreaterThan(0);
  await input.fill("zzzzzzzzzz");
  await expect(page.locator(".no-results")).toBeVisible();
  await input.fill("");
  await page.locator(".artist-directory ul").evaluate((el) => {
    el.scrollTop = 800;
  });
  await expect(input).toBeInViewport();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
test("every research artist is selectable without filler descriptions", async ({
  page,
}) => {
  await ready(page);
  await openIndex(page);
  await page.getByRole("searchbox").fill("Shivanjani Lal");
  await page.locator(".artist-directory li button").first().click();
  await expect(page.locator(".artist-panel h2")).toHaveText("Shivanjani Lal");
  await expect(page.locator(".location-note")).toHaveCount(0);
  await expect(page.locator("[data-marker]")).toHaveCount(216);
});
test("idle die float can be paused in the menu and respects reduced motion", async ({
  page,
}) => {
  await ready(page);
  const float = page.locator(".die-float");
  await expect
    .poll(() => float.evaluate((el) => getComputedStyle(el).animationPlayState))
    .toBe("running");
  await page.getByLabel("Globe menu", { exact: true }).click();
  await page
    .getByRole("checkbox", { name: "Float the die", exact: true })
    .uncheck();
  expect(
    await float.evaluate((el) => getComputedStyle(el).animationPlayState),
  ).toBe("paused");
  await page
    .getByRole("checkbox", { name: "Float the die", exact: true })
    .check();
  await expect
    .poll(() => float.evaluate((el) => getComputedStyle(el).animationPlayState))
    .toBe("running");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await float.evaluate((el) => getComputedStyle(el).animationName)).toBe(
    "none",
  );
});

test("discovery lands in three seconds with monotonic latitude and no wobble", async ({
  page,
}) => {
  await ready(page);
  await expect(page.locator(".discovery-die")).toHaveAttribute(
    "data-model-ready",
    "true",
  );
  await expect(page.locator(".die-model")).toBeVisible();
  await page.locator(".discovery-die").hover();
  expect(
    await page
      .locator(".discovery-die")
      .evaluate((el) => getComputedStyle(el).cursor),
  ).toBe("pointer");
  await page.evaluate(() => {
    (window as any).latitudes = [];
    const host = document.querySelector(".globe-stage")!;
    new MutationObserver(() => {
      if (host.getAttribute("data-view"))
        (window as any).latitudes.push(
          Math.asin(Number(host.getAttribute("data-view")!.split(",")[1])),
        );
    }).observe(host, { attributes: true, attributeFilter: ["data-view"] });
  });
  await page
    .getByRole("button", {
      name: "Roll the die to discover an artist",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Roll the die to discover an artist",
      exact: true,
    }),
  ).toBeDisabled();
  expect(
    await page
      .locator(".discovery-die")
      .evaluate((el) => getComputedStyle(el).cursor),
  ).toBe("default");
  await expect(
    page.getByRole("button", {
      name: "Roll the die to discover an artist",
      exact: true,
    }),
  ).toBeEnabled({ timeout: 10000 });
  expect(
    await page
      .locator(".discovery-die")
      .evaluate((el) => getComputedStyle(el).cursor),
  ).toBe("pointer");
  const latitudes: number[] = await page.evaluate(
    () => (window as any).latitudes,
  );
  expect(latitudes.length).toBeGreaterThan(10);
  const direction = Math.sign(latitudes.at(-1)! - latitudes[0]);
  expect(
    latitudes
      .slice(1)
      .every((lat, i) => (lat - latitudes[i]) * direction >= -0.0001),
  ).toBe(true);
  const distance = await page.locator(".globe-stage").evaluate((el) => {
    const s = el.getBoundingClientRect(),
      p = el.querySelector('[data-spotlight="true"]')!.getBoundingClientRect();
    return Math.hypot(
      p.x + p.width / 2 - s.x - s.width / 2,
      p.y + p.height / 2 - s.y - s.height / 2,
    );
  });
  expect(distance).toBeLessThan(3);
});
for (const direction of [-1, 1]) {
  test(`flicking the die ${direction < 0 ? "left" : "right"} rolls once, follows the flick and lands on an artist`, async ({
    page,
  }) => {
    await ready(page, [demoArtists[1], demoArtists[0]]);
    const die = page.getByRole("button", {
      name: "Roll the die to discover an artist",
    });
    await expect(die).toHaveAttribute("data-model-ready", "true");
    const box = (await die.boundingBox())!;
    const before = await view(page);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width / 2 + direction * 70,
      box.y + box.height / 2 - 25,
      { steps: 6 },
    );
    await expect(die).toHaveClass(/is-dragging/);
    expect(await die.evaluate((el) => getComputedStyle(el).cursor)).toBe(
      "default",
    );
    await page.evaluate(() => {
      (window as any).rollLongitudes = [];
      new MutationObserver(() => {
        const coordinates = document
          .querySelector(".globe-stage")!
          .getAttribute("data-view")!
          .split(",")
          .map(Number);
        (window as any).rollLongitudes.push(
          Math.atan2(-coordinates[2], coordinates[0]),
        );
      }).observe(document.querySelector(".globe-stage")!, {
        attributes: true,
        attributeFilter: ["data-view"],
      });
    });
    await page.mouse.up();
    await expect(die).toBeDisabled();
    await expect(die).toHaveAttribute("data-rolling", "true");
    expect(await die.evaluate((el) => getComputedStyle(el).cursor)).toBe(
      "default",
    );
    await expect(die).toBeEnabled({ timeout: 10000 });
    const samples: number[] = await page.evaluate(
      () => (window as any).rollLongitudes,
    );
    const initial = Math.atan2(-before[2], before[0]);
    expect(samples.length).toBeGreaterThan(10);
    const firstDelta = Math.atan2(
      Math.sin(samples[1] - initial),
      Math.cos(samples[1] - initial),
    );
    expect(Math.sign(firstDelta)).toBe(direction);
    await expect(page.locator(".artist-panel h2")).toHaveText(
      demoArtists[0].name,
    );
    await expect(page.locator(".globe-stage")).toHaveAttribute(
      "data-spotlight",
      demoArtists[0].id,
    );
  });
}
test("a faster die flick tumbles more strongly than a slow pull of the same distance", async ({
  page,
}) => {
  await ready(page, [demoArtists[1], demoArtists[0]]);
  const die = page.locator(".discovery-die");
  await expect(die).toHaveAttribute("data-model-ready", "true");
  const box = (await die.boundingBox())!;
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let step = 1; step <= 7; step++) {
    await page.mouse.move(x + step * 10, y);
    // Deliberately slow this gesture so its release speed differs from a flick.
    await page.waitForTimeout(60);
  }
  await page.mouse.up();
  await expect(die).toHaveAttribute("data-rolling", "true");
  const slowTurns = Number(
    await page.locator(".die-model").getAttribute("data-roll-turns"),
  );
  await expect(die).toBeEnabled({ timeout: 10000 });
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 70, y);
  await page.mouse.up();
  await expect(die).toHaveAttribute("data-rolling", "true");
  const fastTurns = Number(
    await page.locator(".die-model").getAttribute("data-roll-turns"),
  );
  expect(fastTurns).toBeGreaterThan(slowTurns);
  await expect(die).toBeEnabled({ timeout: 10000 });
});
test("dragging stays north-up at the edges and stops at the polar limits", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page, [demoArtists[1]]);
  const box = (await page.locator(".globe-stage canvas").boundingBox())!,
    stage = page.locator(".globe-stage");
  const start = await view(page);
  await page.mouse.move(box.x + box.width * 0.98, box.y + box.height * 0.75);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.98, box.y + box.height * 0.5, {
    steps: 10,
  });
  await page.mouse.up();
  expect(angle(start, await view(page))).toBeGreaterThan(0.5);
  for (let i = 0; i < 6; i++) {
    await page.mouse.move(box.x + box.width * 0.98, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.98, box.y + box.height * 0.75, {
      steps: 8,
    });
    await page.mouse.up();
  }
  expect((Math.asin((await view(page))[1]) * 180) / Math.PI).toBeCloseTo(85, 2);
  await expect(stage).toHaveAttribute("data-up", "0.000000,1.000000,0.000000");
  await page.mouse.move(box.x + box.width * 0.02, box.y + box.height * 0.75);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.02, box.y + box.height * 0.5, {
    steps: 8,
  });
  await page.mouse.up();
  expect((Math.asin((await view(page))[1]) * 180) / Math.PI).toBeLessThan(50);
  await expect(stage).toHaveAttribute("data-up", "0.000000,1.000000,0.000000");
});
test("weighted drag continues smoothly between events and coasts to rest", async ({
  page,
}) => {
  await ready(page, [demoArtists[1]]);
  const box = (await page.locator(".globe-stage canvas").boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.84, box.y + box.height * 0.72);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.97, box.y + box.height * 0.65, {
    steps: 6,
  });
  await page.mouse.up();
  const released = await view(page);
  await page.waitForTimeout(180);
  expect(angle(released, await view(page))).toBeGreaterThan(0.001);
  await expect
    .poll(() => page.locator(".globe-stage").getAttribute("data-moving"), {
      timeout: 6000,
    })
    .toBe("false");
});
test("phone pinch zooms the globe without magnifying the page", async ({
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
  const box = (await page.locator(".globe-stage canvas").boundingBox())!,
    x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: x - 25, y },
      { x: x + 25, y },
    ],
  });
  for (let d = 30; d <= 80; d += 5)
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
      Number(await page.locator(".globe-stage").getAttribute("data-radius")),
    )
    .toBeLessThan(3);
  expect(await page.evaluate(() => visualViewport?.scale)).toBe(1);
  await context.close();
});
test("WebGL failure preserves the index and profiles", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: any[]
    ) {
      if (/webgl/.test(type)) return null;
      return (original as any).call(this, type, ...args);
    } as any;
  });
  await readyFallback(page);
});
async function readyFallback(page: Page) {
  await page.route("**/api/artist-globe/artists", (r) =>
    r.fulfill({ json: { artists: previewCandidates } }),
  );
  await page.goto(route);
  await expect(page.locator(".globe-fallback")).toBeVisible();
  await page.getByRole("button", { name: "Explore the artist index" }).click();
  await expect(page.locator(".artist-directory li")).toHaveCount(216);
}

test("discovery preserves artist identity when several artists share a city pin", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const pair = candidates
    .filter((a: any) => a.current_city === "New York City" && a.map_pin_ready)
    .slice(0, 2);
  await ready(page, pair);
  await page
    .getByRole("button", {
      name: "Roll the die to discover an artist",
      exact: true,
    })
    .click();
  await expect(page.locator(".artist-panel h2")).toHaveText(pair[1].name);
  await expect(page.locator(".globe-stage")).toHaveAttribute(
    "data-spotlight",
    pair[1].id,
  );
});

test("Instagram is explicit and Google search opens the selected artist in a new tab", async ({
  page,
}) => {
  await ready(page);
  await openIndex(page);
  await page.getByRole("searchbox").fill("Shivanjani Lal");
  await page.locator(".artist-directory li button").first().click();
  const instagram = page.locator(".profile-link-instagram");
  await expect(instagram).toHaveText(/Instagram.*@arti_shivanjani/);
  await expect(instagram).toHaveAttribute(
    "href",
    "https://www.instagram.com/arti_shivanjani/",
  );
  await expect(page.locator(".artist-story")).not.toContainText(
    "Documented as",
  );
  await expect(page.locator(".country-flag")).toHaveAttribute(
    "src",
    /au\.png$/,
  );
  await page
    .context()
    .route("https://www.google.com/search**", (r) =>
      r.fulfill({ body: "Search opened" }),
    );
  const popupPromise = page.waitForEvent("popup");
  await page
    .getByRole("link", {
      name: "Learn more about Shivanjani",
      exact: true,
    })
    .click();
  const popup = await popupPromise;
  await popup.waitForLoadState();
  expect(new URL(popup.url()).searchParams.get("q")).toBe("Shivanjani Lal");
  await popup.close();
});

test("mechanical coordinates show whole degrees below the flag with the die underneath", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page, [demoArtists[1]]);
  const coordinates = page.getByLabel("Central pointer coordinates", {
    exact: true,
  });
  await expect(
    page.getByRole("spinbutton", { name: "Latitude", exact: true }),
  ).toHaveAttribute("aria-valuetext", "52° N");
  await expect(
    page.getByRole("spinbutton", { name: "Longitude", exact: true }),
  ).toHaveAttribute("aria-valuetext", "0° W");
  await page.locator(".globe-stage canvas").focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("spinbutton", { name: "Longitude", exact: true }),
  ).toHaveAttribute("aria-valuetext", "9° E");
  const globe = (await page.locator(".globe-workspace").boundingBox())!,
    text = (await coordinates.boundingBox())!,
    button = (await page.locator(".discovery-die").boundingBox())!;
  expect(globe.x + globe.width - text.x - text.width).toBeLessThan(25);
  const flag = (await page.locator(".country-flag").boundingBox())!;
  expect(text.y).toBeGreaterThan(flag.y + flag.height);
  expect(button.y).toBeGreaterThan(text.y + text.height);
  expect(button.width).toBe(112);
});

test("clicking a yellow pin keeps its artist in the card throughout the flight", async ({
  page,
}) => {
  await ready(page, [demoArtists[1], demoArtists[17], demoArtists[5]]);
  await page.evaluate(() => {
    (window as any).cardNames = [];
    const heading = document.querySelector(".artist-panel h2")!;
    new MutationObserver(() => {
      (window as any).cardNames.push(heading.textContent);
    }).observe(heading, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  });
  await page.locator('[data-marker="demo-006"]').click();
  await expect(page.locator(".artist-panel h2")).toHaveText("Luca Reed");
  await expect
    .poll(() => page.locator(".globe-stage").getAttribute("data-moving"), {
      timeout: 6000,
    })
    .toBe("false");
  expect(
    await page.evaluate(() => [...new Set((window as any).cardNames)]),
  ).toEqual(["Luca Reed"]);
  await expect(
    page.getByRole("link", {
      name: "Learn more about Luca",
      exact: true,
    }),
  ).toBeVisible();
});

test("country hierarchy is lighter, flag sits below settings, and cream links share equal weight", async ({
  page,
}) => {
  await ready(page);
  await openIndex(page);
  await page.getByRole("searchbox").fill("Adrián Balseca");
  await page.locator(".artist-directory li button").first().click();
  await expect(page.locator(".artist-summary .country-name")).toHaveText(
    "Ecuador",
  );
  await expect(page.locator(".artist-summary .artist-city")).toHaveText(
    "Quito",
  );
  await expect(page.locator(".artist-summary .artist-practice")).toHaveCount(0);
  await expect(page.locator(".artist-story > .artist-practice")).toContainText(
    "Moving image",
  );
  const flag = (await page.locator(".country-flag").boundingBox())!,
    country = (await page.locator(".country-name").boundingBox())!,
    city = (await page.locator(".artist-city").boundingBox())!;
  expect(flag.width).toBe(80);
  const name = (await page.locator(".artist-summary h2").boundingBox())!;
  expect(Math.abs(country.x - name.x)).toBeLessThan(1);
  const countryWeight = await page
    .locator(".country-name")
    .evaluate((el) => getComputedStyle(el).fontWeight);
  expect(Number(countryWeight)).toBeLessThan(500);
  await expect(page.locator(".artist-summary .country-flag")).toHaveCount(0);
  expect(city.y).toBeGreaterThan(country.y + country.height - 1);
  expect(
    await page
      .locator(".artist-links")
      .evaluate((el) => getComputedStyle(el).borderTopWidth),
  ).toBe("1px");
  await openIndex(page);
  await page.getByRole("searchbox").fill("Shivanjani Lal");
  await page.locator(".artist-directory li button").first().click();
  const styles = await page.locator(".artist-links a").evaluateAll((els) =>
    els.map((el) => {
      const s = getComputedStyle(el);
      return [s.fontSize, s.fontWeight, s.textDecorationThickness].join("|");
    }),
  );
  expect(styles.length).toBeGreaterThan(2);
  expect(new Set(styles).size).toBe(1);
});

test("coordinate crowns scroll independent axes without page zoom and support keyboard bounds", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page, [demoArtists[1]]);
  const lat = page.getByRole("spinbutton", { name: "Latitude", exact: true }),
    lon = page.getByRole("spinbutton", { name: "Longitude", exact: true }),
    stage = page.locator(".globe-stage");
  const radius = await stage.getAttribute("data-radius"),
    scroll = await page.evaluate(() => scrollY);
  await lat.hover();
  await page.mouse.wheel(0, -100);
  await expect(lat).toHaveAttribute("aria-valuetext", "53° N");
  await expect(lon).toHaveAttribute("aria-valuetext", "0° W");
  await lon.hover();
  await page.mouse.wheel(0, 100);
  await expect(lon).toHaveAttribute("aria-valuetext", "1° W");
  await expect(lat).toHaveAttribute("aria-valuetext", "53° N");
  await page.mouse.wheel(100, 0);
  await expect(lon).toHaveAttribute("aria-valuetext", "0° W");
  await expect(lat).toHaveAttribute("aria-valuetext", "53° N");
  expect(await stage.getAttribute("data-radius")).toBe(radius);
  expect(await page.evaluate(() => scrollY)).toBe(scroll);
  await lat.focus();
  await page.keyboard.press("End");
  await expect(lat).toHaveAttribute("aria-valuenow", "85");
  await page.keyboard.press("ArrowUp");
  await expect(lat).toHaveAttribute("aria-valuenow", "85");
  await page.keyboard.press("Home");
  await expect(lat).toHaveAttribute("aria-valuenow", "-85");
  await lon.focus();
  await page.keyboard.press("End");
  await expect(lon).toHaveAttribute("aria-valuenow", "180");
  await page.keyboard.press("ArrowUp");
  await expect(lon).toHaveAttribute("aria-valuenow", "-179");
});

test("longitude dragging stays horizontal with a left-right cursor and ignores vertical pulls", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page, [demoArtists[1]]);
  const lon = page.getByRole("spinbutton", { name: "Longitude", exact: true });
  const lat = page.getByRole("spinbutton", { name: "Latitude", exact: true });
  const box = (await lon.boundingBox())!;
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  expect(await lon.evaluate((el) => getComputedStyle(el).cursor)).toBe(
    "ew-resize",
  );
  await page.mouse.down();
  await page.mouse.move(x + 40, y + 25, { steps: 8 });
  await expect(lon).toHaveAttribute("data-dragging", "true");
  expect(await lon.evaluate((el) => getComputedStyle(el).cursor)).toBe(
    "ew-resize",
  );
  await page.mouse.up();
  await expect(lon).not.toHaveAttribute("data-dragging", "true");
  await expect(lon).toHaveAttribute("aria-valuetext", "6° E");
  await expect(lat).toHaveAttribute("aria-valuetext", "52° N");
  const before = await view(page);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y - 30, { steps: 6 });
  await page.mouse.up();
  expect(await view(page)).toEqual(before);
});

test("coordinate crown dragging and smooth scrolling keep the displayed position in sync", async ({
  page,
}) => {
  await ready(page, [demoArtists[1]]);
  const lat = page.getByRole("spinbutton", { name: "Latitude", exact: true });
  await lat.hover();
  await page.mouse.wheel(0, -500);
  await expect(lat).toHaveAttribute("aria-valuetext", "57° N");
  await expect
    .poll(() => page.locator(".globe-stage").getAttribute("data-moving"))
    .toBe("false");
  const box = (await lat.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 40, {
    steps: 8,
  });
  await page.mouse.up();
  await expect(lat).toHaveAttribute("aria-valuetext", "63° N");
  await expect
    .poll(() => page.locator(".globe-stage").getAttribute("data-moving"))
    .toBe("false");
  const vector = await view(page);
  expect((Math.asin(vector[1]) * 180) / Math.PI).toBeCloseTo(62.51, 1);
});
