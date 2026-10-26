import { expect, test } from "@playwright/test";

test.describe("public site shell", () => {
  test("redirects the root path to the default locale", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.getByRole("region", { name: "Homepage slides" })).toBeVisible();
  });

  test("renders the brand, primary navigation, and footer", async ({ page }) => {
    await page.goto("/en");
    await expect(page.getByRole("banner")).toContainText("MAGLIVE");
    const navigation = page.getByRole("navigation", { name: "Primary navigation" });
    for (const label of ["Products", "Solutions", "Cases", "News", "Documents", "Services", "About"]) {
      await expect(navigation.getByRole("link", { name: label })).toBeVisible();
    }
    const footer = page.getByRole("navigation", { name: "Footer navigation" });
    for (const label of ["Products", "Downloads", "Projects", "About", "News", "Contact"]) {
      await expect(footer.getByRole("link", { name: label })).toBeVisible();
    }
    await expect(
      page.getByText("Power infrastructure, documented with the precision the energy transition demands."),
    ).toBeVisible();
  });

  test("opens every static public page from the primary navigation", async ({ page }) => {
    const routes: Array<[path: string, heading: RegExp]> = [
      ["/en/about", /Engineering confidence into every energy decision\./],
      ["/en/products", /Every product family, documented the same way\./],
      ["/en/projects", /From first survey to steady output\./],
      ["/en/news", /A clear channel for future company updates\./],
      ["/en/downloads", /Technical documents, organized around real products\./],
      ["/en/contact", /Start with the right technical conversation\./],
    ];

    for (const [path, heading] of routes) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    }

    await page.goto("/en");
    await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "About" }).click();
    await expect(page).toHaveURL(/\/en\/about$/);
    await expect(
      page.getByRole("heading", { level: 1, name: /Engineering confidence into every energy decision\./ }),
    ).toBeVisible();
  });

  test("switches the locale between English and Simplified Chinese", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("button", { name: /Choose language/ }).click();
    await page.getByRole("link", { name: "简体中文" }).click();
    await expect(page).toHaveURL(/\/zh$/);
    await expect(page.getByRole("region", { name: "首页幻灯片" })).toBeVisible();

    await page.getByRole("button", { name: /选择语言/ }).click();
    await page.getByRole("link", { name: "English" }).click();
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.getByRole("region", { name: "Homepage slides" })).toBeVisible();
  });

  test("retains the selected locale across navigation", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("button", { name: /Choose language/ }).click();
    await page.getByRole("link", { name: "简体中文" }).click();
    await expect(page).toHaveURL(/\/zh$/);
    await page.getByRole("banner").getByRole("link", { name: "联系我们" }).click();
    await expect(page).toHaveURL(/\/zh\/contact$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "从正确的技术沟通开始。" }),
    ).toBeVisible();
  });
});
