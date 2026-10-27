import { test, expect } from "@playwright/test";

for (const width of [1440, 390]) {
  test(`Lab project opens the working globe at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/lab");
    const card = page.locator(".lab-card").filter({
      has: page.getByRole("heading", {
        name: "Art in Every Corner",
        exact: true,
      }),
    });
    await card.scrollIntoViewIfNeeded();
    const image = card.locator("img");
    await expect
      .poll(() =>
        image.evaluate(
          (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
        ),
      )
      .toBe(true);
    expect(
      await image.evaluate((img: HTMLImageElement) => img.currentSrc),
    ).toMatch(/globe-quito\.webp$/);
    await card.locator(".lab-card__shell").click();
    await expect(page).toHaveURL(/\/lab\/art-in-every-corner$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      /Art in.*Every Corner/,
    );
    await expect(
      page
        .getByRole("banner")
        .getByRole("link", { name: "Abodid Sahoo homepage" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.locator(".globe-stage[data-view]")).toBeVisible({
      timeout: 25000,
    });
    await expect(page.locator("[data-marker]")).toHaveCount(216);
    await expect(page.locator(".atlas-header")).toHaveCount(0);
    await expect(
      page
        .getByRole("banner")
        .getByRole("link", { name: "Abodid Sahoo homepage" }),
    ).toBeVisible();
    const infoButton = page.getByRole("button", {
      name: "Project Info",
      exact: true,
    });
    await infoButton.scrollIntoViewIfNeeded();
    await infoButton.click();
    const popup = page.getByRole("dialog", {
      name: "Project Info",
      exact: true,
    });
    await expect(popup).toBeVisible();
    const close = popup.getByRole("button", { name: "Close project info" });
    await expect(close).toBeFocused();
    await expect(
      popup.getByRole("heading", { name: "Why this project?" }),
    ).toBeVisible();
    await expect(popup).toContainText(
      "100,000 emerging artists over the next three years",
    );
    const body = popup.locator(".project-info-body");
    await body.hover();
    await page.mouse.wheel(0, 1500);
    await expect
      .poll(() => body.evaluate((el) => el.scrollTop))
      .toBeGreaterThan(0);
    await expect(
      popup.getByRole("heading", { name: "My role" }),
    ).toBeInViewport();
    await expect(close).toBeInViewport();
    const box = (await popup.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y + box.height).toBeLessThanOrEqual(900);
    await close.click();
    await expect(popup).not.toBeVisible();
    await expect(infoButton).toBeFocused();
    await infoButton.click();
    await page.keyboard.press("Escape");
    await expect(popup).not.toBeVisible();
    await expect(infoButton).toBeFocused();
  });
}

test("old project story bookmarks redirect to the globe", async ({ page }) => {
  await page.goto("/lab/art-in-every-corner/about");
  await expect(page).toHaveURL(/\/lab\/art-in-every-corner$/);
  await expect(
    page.getByRole("button", { name: "Project Info", exact: true }),
  ).toBeVisible();
});
