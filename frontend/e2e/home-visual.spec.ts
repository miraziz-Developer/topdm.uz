import { expect, test } from "@playwright/test";

const phones = [
  { name: "280", width: 280, height: 653 },
  { name: "320", width: 320, height: 568 },
  { name: "360", width: 360, height: 640 },
  { name: "390", width: 390, height: 844 },
  { name: "430", width: 430, height: 932 },
] as const;

for (const phone of phones) {
  test(`home visual baseline ${phone.name}px`, async ({ page }) => {
    await page.setViewportSize(phone);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.route("**/api/v1/**", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [], lightning: [], clearance: [], recommended: [] }),
    }));
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator("#home-hero-title")).toBeVisible();
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot(`home-${phone.name}.png`, {
      animations: "disabled",
      caret: "hide",
      scale: "css",
      maxDiffPixelRatio: 0.015,
    });
  });
}