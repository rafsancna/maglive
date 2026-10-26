import { expect, test } from "@playwright/test";

test.describe("admin login flow", () => {
  test("allows the seeded administrator to sign in", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
    await page.getByLabel("Email address").fill("admin@example.com");
    await page.getByLabel("Password", { exact: true }).fill("Correct horse battery staple 42!");
    await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/admin\/?$/);
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Products" })).toBeVisible();
  });

  test("rejects a bad password with a clear message", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email address").fill("admin@example.com");
    await page.getByLabel("Password", { exact: true }).fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator(".admin-alert")).toContainText("The email or password is incorrect.");
  });
});
