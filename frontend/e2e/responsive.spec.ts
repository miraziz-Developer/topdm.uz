import { expect, test } from "@playwright/test";

const viewports = [
  { name: "small phone", width: 320, height: 568 },
  { name: "phone", width: 375, height: 667 },
  { name: "large phone", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

const routes = [
  "/",
  "/landing",
  "/auth",
  "/search",
  "/stylist",
  "/market",
  "/market/local",
  "/market/china",
  "/reels",
  "/map",
  "/checkout",
  "/checkout/click",
  "/checkout/delivery",
  "/orders",
  "/profile",
  "/offline",
] as const;

for (const viewport of viewports) {
  test.describe(viewport.name, () => {
    for (const route of routes) {
      test(`${route} renders without horizontal overflow`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });

        const response = await page.goto(route, { waitUntil: "domcontentloaded" });
        expect(response?.ok(), `${route} should return a successful response`).toBe(true);
        await expect(page.locator("body > *").first(), `${route} should render content`).toBeAttached();
        await expect
          .poll(
            () =>
              page.evaluate(
                () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
              ),
            { message: `${route} overflows horizontally at ${viewport.width}px` },
          )
          .toBeLessThanOrEqual(0);
      });
    }
  });
}