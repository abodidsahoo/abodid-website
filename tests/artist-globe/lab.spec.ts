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
    await expect(page).toHaveURL(/\/lab\/art-in-every-corner\/about$/);
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
    const cover = page.locator(".story-image--hero img");
    await expect
      .poll(() =>
        cover.evaluate(
          (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
        ),
      )
      .toBe(true);
    await page
      .getByRole("link", { name: "Explore the globe", exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(/\/lab\/art-in-every-corner$/);
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
  });
}
