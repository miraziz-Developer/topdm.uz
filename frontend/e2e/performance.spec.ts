import { expect, test } from "@playwright/test";

test("mobile home stays within critical performance budgets", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    (window as typeof window & { __qualityMetrics?: Record<string, number> }).__qualityMetrics = {};
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries.at(-1);
      if (last) (window as typeof window & { __qualityMetrics?: Record<string, number> }).__qualityMetrics!.lcp = last.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    let cls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
        if (!entry.hadRecentInput) cls += entry.value;
      }
      (window as typeof window & { __qualityMetrics?: Record<string, number> }).__qualityMetrics!.cls = cls;
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.route("**/api/v1/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ items: [], lightning: [], clearance: [], recommended: [] }),
  }));

  await page.goto("/", { waitUntil: "networkidle" });
  await page.locator("#home-hero-title").click();
  await page.waitForTimeout(500);

  const metrics = await page.evaluate(() => {
    const quality = (window as typeof window & { __qualityMetrics?: Record<string, number> }).__qualityMetrics ?? {};
    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    return {
      lcp: quality.lcp ?? 0,
      cls: quality.cls ?? 0,
      transferBytes: resources.reduce((total, resource) => total + resource.transferSize, 0),
    };
  });

  expect(metrics.lcp, "LCP observer should capture a rendered candidate").toBeGreaterThan(0);
  expect(metrics.lcp, "LCP should remain below 2.5s in the deterministic CI profile").toBeLessThan(2_500);
  expect(metrics.cls, "CLS should remain below the Core Web Vitals good threshold").toBeLessThan(0.1);
  expect(metrics.transferBytes, "initial transferred resources should remain below 2.5 MB").toBeLessThan(2_500_000);
});