import { expect, test } from "@playwright/test";

test("shows simple PayPal and India payment options without a human gate", async ({
    page,
}) => {
    await page.route("https://www.paypal.com/**", (route) => route.abort());
    await page.route("https://checkout.razorpay.com/**", (route) =>
        route.abort(),
    );

    await page.goto("/payments", { waitUntil: "domcontentloaded" });

    await expect(
        page.getByRole("heading", { name: "Choose a payment method" }),
    ).toBeVisible();
    await expect(page.locator(".payment-panel")).toHaveCount(2);
    await expect(page.locator(".human-gate")).toHaveCount(0);
    await expect(
        page.getByText("International Payment", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Pay Now", { exact: true })).toBeVisible();
    await expect(page.locator('script[src*="paypal.com/sdk/js"]')).toHaveCount(
        1,
    );
    await expect(
        page.locator('script[src*="checkout.razorpay.com/v1/payment-button.js"]'),
    ).toHaveCount(1);
});
