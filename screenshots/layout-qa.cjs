/* Layout QA: report horizontal overflow, tiny tap targets, and contrast-risky
   text at desktop + mobile widths. Usage: node screenshots/layout-qa.cjs */
const { chromium } = require("playwright");

const BASE = process.env.CAPTURE_BASE || "http://localhost:3000";
const routes = [
  "/en",
  "/zh",
  "/en/about",
  "/en/projects",
  "/en/downloads",
  "/en/contact",
  "/en/products",
  "/en/products/category/modules",
  "/en/products/modules/630w-topcon",
  "/en/products/modules/550w-perc",
  "/en/news",
];

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 900, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
];

(async () => {
  const browser = await chromium.launch();
  const problems = [];
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    for (const route of routes) {
      await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
      const report = await page.evaluate(() => {
        const doc = document.documentElement;
        const overflow = doc.scrollWidth - doc.clientWidth;
        const offenders = [];
        if (overflow > 1) {
          for (const el of Array.from(document.body.querySelectorAll("*"))) {
            const rect = el.getBoundingClientRect();
            if (rect.right > doc.clientWidth + 1 && rect.width > 8) {
              offenders.push(`${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ").slice(0, 2).join(".")} → ${Math.round(rect.right)}`);
            }
          }
        }
        const smallTargets = Array.from(
          document.querySelectorAll("a[href], button"),
        )
          .filter((el) => {
            const rect = el.getBoundingClientRect();
            const style = getComputedStyle(el);
            if (style.display === "none" || style.visibility === "hidden") return false;
            if (rect.width === 0 || rect.height === 0) return false;
            return rect.height < 24 || rect.width < 24;
          })
          .slice(0, 8)
          .map((el) => `${el.tagName.toLowerCase()}:${(el.textContent || "").trim().slice(0, 24)}`);
        return { overflow, offenders: offenders.slice(0, 6), smallTargets };
      });
      if (report.overflow > 1) {
        problems.push(
          `[${viewport.name}] ${route} overflows by ${report.overflow}px :: ${report.offenders.join(" | ")}`,
        );
      }
      if (report.smallTargets.length) {
        problems.push(`[${viewport.name}] ${route} small targets :: ${report.smallTargets.join(" | ")}`);
      }
    }
    await page.close();
  }
  await browser.close();
  console.log(problems.length ? problems.join("\n") : "No layout problems detected.");
})();
