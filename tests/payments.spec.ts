import { expect, test } from "@playwright/test";

test("payment gateways load only after the human gate unlocks", async ({ page }) => {
    await page.route("https://www.paypal.com/**", (route) => route.abort());
    await page.route("https://checkout.razorpay.com/**", (route) =>
        route.abort(),
    );

    await page.goto("/payments", { waitUntil: "domcontentloaded" });

    await expect(
        page.getByRole("heading", { name: "Payments" }),
    ).toBeVisible();
    await expect(page.locator('script[src*="paypal.com/sdk/js"]')).toHaveCount(
        0,
    );
    await expect(
        page.locator('script[src*="checkout.razorpay.com/v1/payment-button.js"]'),
    ).toHaveCount(0);

    await page.locator('[data-payment-option="india"]').click();
    await page.locator("[data-human-confirm]").check();
    await page.waitForTimeout(1200);
    await page.getByRole("button", { name: "Unlock India checkout" }).click();

    await expect(
        page.locator('script[src*="checkout.razorpay.com/v1/payment-button.js"]'),
    ).toHaveCount(1);
    await expect(page.locator('script[src*="paypal.com/sdk/js"]')).toHaveCount(
        0,
    );
});
