import { expect, test } from "@playwright/test";

test.describe("public site shell", () => {
  test("redirects the root path to the default locale", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/en$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Power infrastructure, presented with clarity." }),
    ).toBeVisible();
  });

  test("renders the brand, primary navigation, and footer", async ({ page }) => {
    await page.goto("/en");
    await expect(page.getByRole("banner")).toContainText("MAGLIVE");
    const navigation = page.getByRole("navigation", { name: "Primary navigation" });
    for (const label of ["Home", "About", "Products", "Projects", "News", "Downloads", "Contact"]) {
      await expect(navigation.getByRole("link", { name: label })).toBeVisible();
    }
    await expect(page.getByText("Technical energy products, communicated with precision.")).toBeVisible();
  });

  test("opens every static public page from the primary navigation", async ({ page }) => {
    const routes: Array<[label: string, path: string, heading: RegExp]> = [
      ["About", "/en/about", /Engineering confidence into every energy decision\./],
      ["Products", "/en/products", /A structured home for every product family\./],
      ["Projects", "/en/projects", /Project storytelling will follow verified delivery data\./],
      ["News", "/en/news", /A clear channel for future company updates\./],
      ["Downloads", "/en/downloads", /Technical documents, organized around real products\./],
      ["Contact", "/en/contact", /Start with the right technical conversation\./],
    ];

    for (const [label, path, heading] of routes) {
      await page.goto("/en");
      await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: label }).click();
      await expect(page).toHaveURL(new RegExp(`${path.replaceAll("/", "\\/")}$`));
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    }
  });

  test("switches the locale between English and Simplified Chinese", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("group", { name: "Choose language" }).getByRole("link", { name: "简体中文" }).click();
    await expect(page).toHaveURL(/\/zh$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "让电力基础设施清晰呈现。" }),
    ).toBeVisible();

    await page.getByRole("group", { name: "选择语言" }).getByRole("link", { name: "English" }).click();
    await expect(page).toHaveURL(/\/en$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Power infrastructure, presented with clarity." }),
    ).toBeVisible();
  });

  test("retains the selected locale across navigation", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("group", { name: "Choose language" }).getByRole("link", { name: "简体中文" }).click();
    await expect(page).toHaveURL(/\/zh$/);
    await page.getByRole("navigation", { name: "主导航" }).getByRole("link", { name: "联系我们" }).click();
    await expect(page).toHaveURL(/\/zh\/contact$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "从正确的技术沟通开始。" }),
    ).toBeVisible();
  });
});