import { expect, test } from "@playwright/test";

test.describe("public catalog browsing", () => {
  test("shows seeded products on the catalog page", async ({ page }) => {
    await page.goto("/en/products");
    await expect(
      page.getByRole("heading", { level: 1, name: "Every product family, documented the same way." }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Categories" })).toBeVisible();
    await expect(page.getByRole("link", { name: "630 W TOPCon module" })).toBeVisible();
    await expect(page.getByRole("link", { name: "550 W PERC module" })).toBeVisible();
  });

  test("opens a product detail page from the catalog", async ({ page }) => {
    await page.goto("/en/products");
    await page.getByRole("link", { name: "630 W TOPCon module" }).first().click();
    await expect(page).toHaveURL(/\/en\/products\/modules\/630w-topcon$/);
    await expect(page.getByRole("heading", { level: 1, name: "630 W TOPCon module" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Technology" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Specifications" })).toBeVisible();
  });

  test("shows the localized product catalog in Chinese", async ({ page }) => {
    await page.goto("/zh/products");
    await expect(page.getByRole("link", { name: "630瓦TOPCon组件" })).toBeVisible();
    await expect(page.getByRole("link", { name: "550瓦PERC组件" })).toBeVisible();
  });
});
