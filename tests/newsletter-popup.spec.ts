import { expect, test, type Page } from "@playwright/test";

const POPUP_SELECTOR = ".newsletter-popup-wrapper";
const POPUP_STATE_KEY = "newsletter_popup_state_v2";
const LEGACY_DISMISSED_KEY = "newsletter_popup_dismissed";
const FOOTER_FORM_SESSION_KEY = "newsletter_popup_footer_form_session_v1";

type SnapshotOptions = {
    currentPath: string;
    sessionId?: string;
    sessionAgeMs?: number;
    currentPageDwellMs?: number;
    totalTrackedMs?: number;
    uniquePagesVisited?: number;
    totalPageViews?: number;
    previousPaths?: string[];
};

const buildSnapshot = ({
    currentPath,
    sessionId = "newsletter-test-session",
    sessionAgeMs = 3 * 60 * 1000,
    currentPageDwellMs = 30 * 1000,
    totalTrackedMs = 3 * 60 * 1000,
    uniquePagesVisited = 3,
    totalPageViews = 4,
    previousPaths = [],
}: SnapshotOptions) => {
    const now = Date.now();
    const historySpacingMs = 15 * 1000;
    const visitSequence = previousPaths.map((path, index) => ({
        path,
        title: path,
        enteredAt: new Date(
            now - currentPageDwellMs - historySpacingMs * (previousPaths.length - index),
        ).toISOString(),
    }));

    visitSequence.push({
        path: currentPath,
        title: currentPath,
        enteredAt: new Date(now - currentPageDwellMs).toISOString(),
    });

    return {
        sessionId,
        startedAt: new Date(now - sessionAgeMs).toISOString(),
        currentPath,
        currentPageTitle: currentPath,
        landingPage: previousPaths[0] || currentPath,
        initialReferrer: "",
        lastSourcePage: "",
        lastSourceName: "",
        lastCta: "",
        totalTrackedMs,
        totalPageViews,
        uniquePagesVisited,
        recentPages: visitSequence.slice(-8),
        visitSequence,
        topPages: [
            {
                path: currentPath,
                title: currentPath,
                durationMs: currentPageDwellMs,
            },
        ],
    };
};

type JourneySnapshot = ReturnType<typeof buildSnapshot>;

const resetPopupState = async (page: Page) => {
    await page.evaluate(
        ({ popupStateKey, legacyDismissedKey, footerSessionKey }) => {
            window.localStorage.removeItem(popupStateKey);
            window.localStorage.removeItem(legacyDismissedKey);
            window.sessionStorage.removeItem(footerSessionKey);
        },
        {
            popupStateKey: POPUP_STATE_KEY,
            legacyDismissedKey: LEGACY_DISMISSED_KEY,
            footerSessionKey: FOOTER_FORM_SESSION_KEY,
        },
    );
};

const installJourneySnapshot = async (
    page: Page,
    snapshot: JourneySnapshot,
) => {
    await page.evaluate((payload) => {
        const journeyWindow = window as Window & {
            __abodidJourney?: { getSnapshot: () => unknown };
        };

        journeyWindow.__abodidJourney = {
            getSnapshot: () => payload,
        };
    }, snapshot);
};

const primePage = async (
    page: Page,
    path: string,
    snapshot: JourneySnapshot,
    { resetStorage = true }: { resetStorage?: boolean } = {},
) => {
    await page.goto(path, { waitUntil: "domcontentloaded" });

    if (resetStorage) {
        await resetPopupState(page);
    }

    await installJourneySnapshot(page, snapshot);
    await page.waitForTimeout(250);
};

const expectNoPopupAfterDelay = async (page: Page, delayMs = 7000) => {
    await page.waitForTimeout(delayMs);
    await expect(page.locator(POPUP_SELECTOR)).toHaveCount(0);
};

const expectPopupToAppear = async (page: Page, timeout = 9000) => {
    await expect(page.locator(POPUP_SELECTOR)).toBeVisible({ timeout });
};

test("stays hidden for quick sessions and shallow content scrolling", async ({
    page,
}) => {
    await primePage(
        page,
        "/",
        buildSnapshot({
            currentPath: "/",
            sessionId: "quick-home-session",
            sessionAgeMs: 60 * 1000,
            currentPageDwellMs: 30 * 1000,
            totalTrackedMs: 30 * 1000,
            uniquePagesVisited: 1,
            totalPageViews: 1,
        }),
    );

    await expectNoPopupAfterDelay(page);

    await primePage(
        page,
        "/research",
        buildSnapshot({
            currentPath: "/research",
            sessionId: "shallow-scroll-session",
            sessionAgeMs: 3 * 60 * 1000,
            currentPageDwellMs: 45 * 1000,
            totalTrackedMs: 45 * 1000,
            uniquePagesVisited: 1,
            totalPageViews: 1,
        }),
    );

    await page.evaluate(() => {
        const maxScroll =
            document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo(0, maxScroll * 0.45);
    });

    await expectNoPopupAfterDelay(page);
});

test("shows only after a footer bounce on long pages", async ({ page }) => {
    await primePage(
        page,
        "/research",
        buildSnapshot({
            currentPath: "/research",
            sessionId: "footer-bounce-session",
            sessionAgeMs: 4 * 60 * 1000,
            currentPageDwellMs: 70 * 1000,
            totalTrackedMs: 70 * 1000,
            uniquePagesVisited: 1,
            totalPageViews: 1,
        }),
    );

    await page.evaluate(() => {
        window.scrollTo(0, document.documentElement.scrollHeight);
    });

    await page.waitForTimeout(3500);

    await page.evaluate(() => {
        const footer = document.querySelector("[data-newsletter-footer]");
        const footerTop = footer
            ? footer.getBoundingClientRect().top + window.scrollY
            : document.documentElement.scrollHeight;
        const targetScroll = Math.max(footerTop - window.innerHeight - 200, 0);
        window.scrollTo(0, targetScroll);
    });

    await expectPopupToAppear(page);
});

test("requires /about plus another strong signal before showing on hire pages", async ({
    page,
}) => {
    await primePage(
        page,
        "/about",
        buildSnapshot({
            currentPath: "/about",
            sessionId: "about-alone-session",
            sessionAgeMs: 3 * 60 * 1000,
            currentPageDwellMs: 25 * 1000,
            totalTrackedMs: 90 * 1000,
            uniquePagesVisited: 1,
            totalPageViews: 1,
        }),
    );

    await expectNoPopupAfterDelay(page);

    await primePage(
        page,
        "/services",
        buildSnapshot({
            currentPath: "/services",
            sessionId: "about-plus-services-session",
            sessionAgeMs: 4 * 60 * 1000,
            currentPageDwellMs: 25 * 1000,
            totalTrackedMs: 2 * 60 * 1000,
            uniquePagesVisited: 2,
            totalPageViews: 2,
            previousPaths: ["/about"],
        }),
    );

    await expectPopupToAppear(page);
});

test("shows for multi-page explorers but never on /contact", async ({ page }) => {
    await primePage(
        page,
        "/blog",
        buildSnapshot({
            currentPath: "/blog",
            sessionId: "explorer-session",
            sessionAgeMs: 4 * 60 * 1000,
            currentPageDwellMs: 25 * 1000,
            totalTrackedMs: 125 * 1000,
            uniquePagesVisited: 3,
            totalPageViews: 4,
            previousPaths: ["/about", "/research", "/films"],
        }),
    );

    await expectPopupToAppear(page);

    await primePage(
        page,
        "/contact",
        buildSnapshot({
            currentPath: "/contact",
            sessionId: "contact-blocked-session",
            sessionAgeMs: 4 * 60 * 1000,
            currentPageDwellMs: 25 * 1000,
            totalTrackedMs: 180 * 1000,
            uniquePagesVisited: 4,
            totalPageViews: 5,
            previousPaths: ["/about", "/services", "/research"],
        }),
    );

    await expectNoPopupAfterDelay(page);
});

test("suppresses the popup for the rest of the session after footer form engagement", async ({
    page,
}) => {
    const sessionId = "footer-form-session";

    await primePage(
        page,
        "/about",
        buildSnapshot({
            currentPath: "/about",
            sessionId,
            sessionAgeMs: 4 * 60 * 1000,
            currentPageDwellMs: 30 * 1000,
            totalTrackedMs: 180 * 1000,
            uniquePagesVisited: 4,
            totalPageViews: 5,
            previousPaths: ["/services", "/research", "/blog"],
        }),
    );

    await page.evaluate(() => {
        window.scrollTo(0, document.documentElement.scrollHeight);
    });

    const footerEmailInput = page.locator(
        '[data-newsletter-inline-form] input[type="email"]',
    );
    await expect(footerEmailInput).toBeVisible();
    await footerEmailInput.click();
    await footerEmailInput.fill("reader@example.com");

    await page.evaluate(() => {
        window.scrollTo(0, 0);
    });

    await expectNoPopupAfterDelay(page);

    await primePage(
        page,
        "/services",
        buildSnapshot({
            currentPath: "/services",
            sessionId,
            sessionAgeMs: 4 * 60 * 1000,
            currentPageDwellMs: 30 * 1000,
            totalTrackedMs: 180 * 1000,
            uniquePagesVisited: 4,
            totalPageViews: 5,
            previousPaths: ["/about", "/research", "/blog"],
        }),
        { resetStorage: false },
    );

    await expectNoPopupAfterDelay(page);
});

test("does not re-show after dismissal in the same session or during cooldown", async ({
    page,
}) => {
    await primePage(
        page,
        "/services",
        buildSnapshot({
            currentPath: "/services",
            sessionId: "dismiss-session",
            sessionAgeMs: 4 * 60 * 1000,
            currentPageDwellMs: 30 * 1000,
            totalTrackedMs: 180 * 1000,
            uniquePagesVisited: 4,
            totalPageViews: 5,
            previousPaths: ["/about", "/research", "/blog"],
        }),
    );

    await expectPopupToAppear(page);

    await page
        .locator(`${POPUP_SELECTOR} button[aria-label="Close"]`)
        .click();

    await primePage(
        page,
        "/research",
        buildSnapshot({
            currentPath: "/research",
            sessionId: "dismiss-session",
            sessionAgeMs: 4 * 60 * 1000,
            currentPageDwellMs: 30 * 1000,
            totalTrackedMs: 180 * 1000,
            uniquePagesVisited: 4,
            totalPageViews: 5,
            previousPaths: ["/about", "/services", "/blog"],
        }),
        { resetStorage: false },
    );

    await expectNoPopupAfterDelay(page);

    await primePage(
        page,
        "/research",
        buildSnapshot({
            currentPath: "/research",
            sessionId: "dismiss-session-new",
            sessionAgeMs: 4 * 60 * 1000,
            currentPageDwellMs: 30 * 1000,
            totalTrackedMs: 180 * 1000,
            uniquePagesVisited: 4,
            totalPageViews: 5,
            previousPaths: ["/about", "/services", "/blog"],
        }),
        { resetStorage: false },
    );

    await expectNoPopupAfterDelay(page);
});

test("stores subscribed state after popup signup and suppresses future popups", async ({
    page,
}) => {
    await page.route("**/api/subscribe", async (route) => {
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ message: "Successfully subscribed!" }),
        });
    });

    await primePage(
        page,
        "/services",
        buildSnapshot({
            currentPath: "/services",
            sessionId: "subscribe-session",
            sessionAgeMs: 4 * 60 * 1000,
            currentPageDwellMs: 30 * 1000,
            totalTrackedMs: 180 * 1000,
            uniquePagesVisited: 4,
            totalPageViews: 5,
            previousPaths: ["/about", "/research", "/blog"],
        }),
    );

    await expectPopupToAppear(page);

    await page
        .locator(`${POPUP_SELECTOR} input[type="email"]`)
        .fill("reader@example.com");
    await page
        .locator(`${POPUP_SELECTOR} button[type="submit"]`)
        .click();

    await expect(page.locator(".newsletter-success")).toBeVisible();

    await primePage(
        page,
        "/research",
        buildSnapshot({
            currentPath: "/research",
            sessionId: "subscribe-session-new",
            sessionAgeMs: 4 * 60 * 1000,
            currentPageDwellMs: 30 * 1000,
            totalTrackedMs: 180 * 1000,
            uniquePagesVisited: 4,
            totalPageViews: 5,
            previousPaths: ["/about", "/services", "/blog"],
        }),
        { resetStorage: false },
    );

    await expectNoPopupAfterDelay(page);
});

test("does not mount on pages that disable the popup entirely", async ({ page }) => {
    await primePage(
        page,
        "/collaboration",
        buildSnapshot({
            currentPath: "/collaboration",
            sessionId: "disabled-page-session",
            sessionAgeMs: 4 * 60 * 1000,
            currentPageDwellMs: 30 * 1000,
            totalTrackedMs: 180 * 1000,
            uniquePagesVisited: 4,
            totalPageViews: 5,
            previousPaths: ["/about", "/services", "/blog"],
        }),
    );

    await expectNoPopupAfterDelay(page);
});
