/* PH11 visual capture — renders the public site at desktop and mobile widths.
   Usage: node screenshots/capture-public.cjs [outDir] */
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const BASE = process.env.CAPTURE_BASE || "http://localhost:3000";
const outDir = path.resolve(process.argv[2] || path.join(__dirname, "ph11"));
fs.mkdirSync(outDir, { recursive: true });

const pages = [
  ["home", "/en"],
  ["home-zh", "/zh"],
  ["about", "/en/about"],
  ["projects", "/en/projects"],
  ["downloads", "/en/downloads"],
  ["contact", "/en/contact"],
  ["products", "/en/products"],
  ["category", "/en/products/category/modules"],
  ["pdp-standard", "/en/products/modules/550w-perc"],
  ["pdp-premium", "/en/products/modules/630w-topcon"],
  ["news", "/en/news"],
];

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844, isMobile: true, hasTouch: true },
];

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
      isMobile: Boolean(viewport.isMobile),
      hasTouch: Boolean(viewport.hasTouch),
    });
    const page = await context.newPage();
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(`${page.url()} :: ${msg.text()}`);
    });
    page.on("pageerror", (error) => errors.push(`${page.url()} :: ${error.message}`));

    for (const [name, route] of pages) {
      await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
      await page.addStyleTag({
        content:
          "*,*::before,*::after{animation-delay:0s!important;animation-duration:0s!important;transition:none!important}nextjs-portal{display:none!important}",
      });
      await page.waitForTimeout(900);
      await page.screenshot({
        path: path.join(outDir, `${name}-${viewport.name}.png`),
        fullPage: true,
      });
    }

    if (viewport.name === "mobile") {
      await page.goto(`${BASE}/en`, { waitUntil: "networkidle" });
      await page.click(".nav-toggle");
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(outDir, "mobile-menu.png") });
      await page.click(".mobile-menu__section-trigger >> nth=0");
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(outDir, "mobile-menu-open.png") });
    } else {
      await page.goto(`${BASE}/en`, { waitUntil: "networkidle" });
      await page.hover(".primary-nav__item >> nth=0 >> .primary-nav__link");
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(outDir, "desktop-mega-menu.png") });
    }

    await context.close();
  }
  await browser.close();
  if (errors.length) {
    console.log("Console errors:\n" + [...new Set(errors)].join("\n"));
  } else {
    console.log("No console errors.");
  }
  console.log(`Screenshots written to ${outDir}`);
})();
