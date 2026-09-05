import { test, expect } from "@playwright/test";

test.describe("Customer storefront smoke", () => {
  test("home page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Bozor|Bozorliii/i);
  });

  test("landing page presents clear customer and merchant actions", async ({ page }) => {
    await page.goto("/landing");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Bozor endi sizga");
    await expect(page.getByRole("link", { name: "Xaridni boshlash" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Do‘konni ulash" }).first()).toBeVisible();
  });

  test("search page loads", async ({ page }) => {
    await page.goto("/search");
    await expect(page.getByRole("heading", { level: 1, name: "Mahsulot qidirish" })).toBeAttached();
  });

  test("map page loads", async ({ page }) => {
    await page.goto("/map");
    await expect(page.locator("body")).toBeVisible();
  });

  test("checkout page loads", async ({ page }) => {
    await page.goto("/checkout");
    await expect(page.getByRole("heading", { level: 1, name: "Buyurtmani rasmiylashtirish" })).toBeVisible();
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
