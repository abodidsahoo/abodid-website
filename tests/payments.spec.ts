import { expect, test } from "@playwright/test";

test("shows Stripe, PayPal and India checkout with the saved account settings", async ({
    page,
}) => {
    await page.route("https://www.paypal.com/**", (route) => route.abort());
    await page.route("https://js.stripe.com/**", (route) => route.abort());
    await page.route("https://checkout.razorpay.com/**", (route) =>
        route.abort(),
    );

    await page.goto("/payments", { waitUntil: "domcontentloaded" });

    await expect(
        page.getByRole("heading", { name: "Choose a payment method." }),
    ).toBeVisible();
    await expect(page.locator(".payment-panel")).toHaveCount(3);
    await expect(page.locator(".human-gate")).toHaveCount(0);
    await expect(
        page.getByText("International payment", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("India payment", { exact: true })).toBeVisible();
    await expect(page.locator("stripe-buy-button")).toHaveAttribute(
        "buy-button-id", "buy_btn_1UBHZdKa33KIMUWuNtt0OBoG",
    );
    await expect(page.locator("stripe-buy-button")).toHaveAttribute(
        "publishable-key",
        "pk_live_51MhJi6Ka33KIMUWu346ex5sH1Q36XRuy5JFt4ZHIdkwW9R6vvnDOJq38O92gaUTVrMOBAh7gF0sxJ8RMqxYKbnpK00XFTzmsMX",
    );
    await expect(
        page.locator('iframe[title="PayPal checkout"]'),
    ).toHaveAttribute("srcdoc", /paypal\.com\/sdk\/js/);
    await expect(
        page.locator('iframe[title="PayPal checkout"]'),
    ).toHaveAttribute("srcdoc", /HostedButtons/);
    await expect(page.locator('[data-paypal-frame]')).toHaveAttribute(
        "srcdoc", /hostedButtonId: "22T4QFMFG6BDS"/,
    );
    await expect(
        page.locator('script[src*="paypal.com/sdk/js"]'),
    ).toHaveCount(0);
    await expect(
        page.locator('script[src*="checkout.razorpay.com/v1/payment-button.js"]'),
    ).toHaveAttribute("data-payment_button_id", "pl_T1pqkmNlgYnS0d");
});
