import { expect, test } from "@playwright/test";

test.describe("Mobile quality", () => {
  test.use({ viewport: { width: 320, height: 568 } });

  test("supports 200% text without horizontal overflow", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.locator("html").evaluate((element) => { element.style.fontSize = "200%"; });
    await expect(page.locator("#home-hero-title")).toBeVisible();
    await expect.poll(() => page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )).toBeLessThanOrEqual(0);
  });

  test("primary mobile navigation has names, current state and touch targets", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const navLinks = page.locator(".premium-dock > a");
    await expect(page.getByRole("link", { name: "Bosh sahifa" })).toHaveAttribute("aria-current", "page");
    const smallTargets = await navLinks.evaluateAll((elements) => elements.filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width < 44 || rect.height < 44;
    }).length);
    expect(smallTargets).toBe(0);
  });

  test("reels failure provides a retry action", async ({ page }) => {
    await page.route("**/api/v1/reels/feed**", (route) => route.fulfill({ status: 503, body: "unavailable" }));
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("alert").filter({ hasText: "Videolarni yuklab bo'lmadi" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Qayta urinish" })).toBeVisible();
  });

  test("slow reels response keeps an accessible loading state", async ({ page }) => {
    await page.route("**/api/v1/reels/feed**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }) });
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("status", { name: "Reels yuklanmoqda" })).toBeVisible();
  });

  test("landscape layout remains usable", async ({ page }) => {
    await page.setViewportSize({ width: 653, height: 280 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#home-hero-title")).toBeVisible();
    await expect.poll(() => page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )).toBeLessThanOrEqual(0);
  });
});