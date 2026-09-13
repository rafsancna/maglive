const { chromium } = require("playwright");

function parseRgb(value) {
  const m = value.match(/-?\d+(\.\d+)?/g);
  if (!m) return null;
  return m.map(Number);
}

function isLight([r, g, b]) {
  return r > 235 && g > 235 && b > 235;
}

function isDarkText([r, g, b]) {
  return r < 60 && g < 60 && b < 70;
}

function isBrandRed([r, g, b]) {
  return r > 140 && g < 90 && b < 90;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
  const results = [];
  const check = (name, ok, detail = "") => results.push(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`);

  await page.goto("http://localhost:3000/en", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  // 1. Header is light
  const headerBg = await page.$eval(".site-header", (el) => getComputedStyle(el).backgroundColor);
  check("header light background", isLight(parseRgb(headerBg)), headerBg);

  // 2. Brand logo red, G-plate white knockout
  const logoColor = await page.$eval(".brand__logo", (el) => getComputedStyle(el).color);
  check("brand logo red", isBrandRed(parseRgb(logoColor)), logoColor);
  const gColor = await page.$eval(".brand__logo-g", (el) => getComputedStyle(el).color);
  check("boxed G white knockout", parseRgb(gColor)[0] > 240, gColor);

  // 3. Nav links dark-on-light
  const navColor = await page.$eval(".primary-nav__link, .primary-nav__trigger", (el) => getComputedStyle(el).color);
  check("nav links dark text", isDarkText(parseRgb(navColor)), navColor);

  // 4. Mega menu: white panel, red top border, compact heading row
  await page.hover("nav.primary-nav button:has-text('Products')");
  await page.waitForTimeout(500);
  const menuBg = await page.$eval(".mega-menu", (el) => getComputedStyle(el).backgroundColor);
  check("mega menu white panel", parseRgb(menuBg)[0] > 250, menuBg);
  const menuBorder = await page.$eval(".mega-menu", (el) => getComputedStyle(el).borderTopColor);
  check("mega menu red top border", isBrandRed(parseRgb(menuBorder)), menuBorder);
  const heading = await page.$eval(".mega-menu__heading", (el) => {
    const s = getComputedStyle(el);
    const h2 = el.querySelector("h2").getBoundingClientRect();
    const p = el.querySelector("p") ? el.querySelector("p").getBoundingClientRect() : null;
    return { display: s.display, height: Math.round(el.getBoundingClientRect().height), oneRow: p ? Math.abs(h2.top - p.top) < 8 : true };
  });
  check("mega heading single flex row", heading.display === "flex" && heading.oneRow, JSON.stringify(heading));
  check("mega heading compact (<64px)", heading.height < 64, `${heading.height}px`);
  const menuH = await page.$eval(".mega-menu", (el) => Math.round(el.getBoundingClientRect().height));
  check("products menu height < 560px", menuH < 560, `${menuH}px`);

  // 5. Other menus render
  for (const label of ["Solutions", "Cases", "News", "Documents"]) {
    await page.hover(`nav.primary-nav button:has-text('${label}')`);
    await page.waitForTimeout(700);
    const info = await page.$eval(".mega-menu", (el) => ({
      h: Math.round(el.getBoundingClientRect().height),
      hasHeading: !!el.querySelector(".mega-menu__heading"),
    }));
    check(`${label} menu renders`, info.h > 60 && info.hasHeading, JSON.stringify(info));
  }

  // 6. Scrolled header stays light
  await page.mouse.move(10, 500);
  await page.evaluate(() => window.scrollTo(0, 800));
  await page.waitForTimeout(500);
  const scrolledBg = await page.$eval(".site-header", (el) => getComputedStyle(el).backgroundColor);
  check("scrolled header light", isLight(parseRgb(scrolledBg)), scrolledBg);

  // 7. Closing panel light + footer light with red logo and dark text
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  const closingBg = await page.$eval(".closing-panel", (el) => getComputedStyle(el).backgroundColor);
  check("closing panel light", isLight(parseRgb(closingBg)), closingBg);
  const footerBg = await page.$eval(".site-footer", (el) => getComputedStyle(el).backgroundColor);
  check("footer light", isLight(parseRgb(footerBg)), footerBg);
  const footerLogo = await page.$eval(".site-footer .brand__logo", (el) => getComputedStyle(el).color);
  check("footer logo red", isBrandRed(parseRgb(footerLogo)), footerLogo);
  const footerText = await page.$eval(".site-footer p", (el) => getComputedStyle(el).color);
  check("footer text dark", parseRgb(footerText)[0] < 120, footerText);

  // 8. Mobile menu light
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto("http://localhost:3000/en", { waitUntil: "networkidle" });
  await mobile.click(".nav-toggle");
  await mobile.waitForTimeout(450);
  const mobileBg = await mobile.$eval(".mobile-menu", (el) => getComputedStyle(el).backgroundColor);
  check("mobile menu light", isLight(parseRgb(mobileBg)), mobileBg);
  const mobileText = await mobile.$eval(".mobile-menu__section-trigger", (el) => getComputedStyle(el).color);
  check("mobile menu text dark", parseRgb(mobileText)[0] < 60, mobileText);
  const mobileToggleBg = await mobile.$eval(".nav-toggle", (el) => getComputedStyle(el).backgroundColor);
  check("nav toggle light", isLight(parseRgb(mobileToggleBg)), mobileToggleBg);

  // 9. News accent still red
  await page.goto("http://localhost:3000/en/news", { waitUntil: "networkidle" });
  const accent = await page.$eval(".news-feature__meta span", (el) => getComputedStyle(el).color);
  check("news accent red", isBrandRed(parseRgb(accent)), accent);

  const fails = results.filter((r) => r.startsWith("FAIL")).length;
  console.log(results.join("\n"));
  console.log(`\n${results.length - fails}/${results.length} passed`);
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
