import { test, expect } from "@playwright/test";

test.describe("Customer storefront smoke", () => {
  test("home page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Bozor|Bozorliii/i);
  });

  test("search page loads", async ({ page }) => {
    await page.goto("/search");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("map page loads", async ({ page }) => {
    await page.goto("/map");
    await expect(page.locator("body")).toBeVisible();
  });

  test("checkout page loads", async ({ page }) => {
    await page.goto("/checkout");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/zaxira|Olib/i);
  });

  test("auth page loads", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.locator("body")).toBeVisible();
  });

  test("orders page loads", async ({ page }) => {
    await page.goto("/orders");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Buyurtma/i);
  });
});
