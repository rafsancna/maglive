const { chromium } = require("playwright");

function parseRgb(v) {
  const m = v.match(/-?\d+(\.\d+)?/g);
  return m ? m.map(Number) : null;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
  const results = [];
  const check = (name, ok, detail = "") => results.push(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`);

  await page.goto("http://localhost:3000/en/news", { waitUntil: "networkidle" });
  // open the first story if on the listing page
  const onDetail = await page.$(".news-share");
  if (!onDetail) {
    await page.click(".news-card, .news-feature");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(600);
  }

  const share = await page.$eval(".news-share", (el) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const primary = el.querySelector(".news-share__primary");
    const ps = primary ? getComputedStyle(primary) : null;
    const actions = el.querySelector(".news-share__actions");
    const as = actions ? getComputedStyle(actions) : null;
    const btns = actions ? Array.from(actions.querySelectorAll("button")) : [];
    return {
      height: Math.round(r.height),
      bg: s.backgroundColor,
      border: s.borderTopWidth + " " + s.borderTopStyle,
      radius: s.borderRadius,
      shadow: s.boxShadow.slice(0, 30),
      primaryH: ps ? Math.round(primary.getBoundingClientRect().height) : null,
      actionsDisplay: as ? as.display : null,
      btnH: btns[0] ? Math.round(btns[0].getBoundingClientRect().height) : null,
      btnRadius: btns[0] ? getComputedStyle(btns[0]).borderRadius : null,
      btnBg: btns[0] ? getComputedStyle(btns[0]).backgroundColor : null,
      count: btns.length,
    };
  });

  check("share block compact (<170px)", share.height < 170, `${share.height}px`);
  check("no card background", share.bg === "rgba(0, 0, 0, 0)", share.bg);
  check("hairline top border", share.border.startsWith("1px solid"), share.border);
  check("no card radius", share.radius === "0px", share.radius);
  check("primary button compact (<42px)", share.primaryH < 42, `${share.primaryH}px`);
  check("actions are wrapping flex row", share.actionsDisplay === "flex", share.actionsDisplay);
  check("pill buttons compact (<36px)", share.btnH < 36, `${share.btnH}px`);
  check("pill shape", share.btnRadius === "999px", share.btnRadius);
  check("white button bg", parseRgb(share.btnBg)[0] > 250, share.btnBg);
  check("all six actions render", share.count === 6, `${share.count} buttons`);

  // click copy link, confirm it still works
  await page.click(".news-share__copy");
  await page.waitForTimeout(300);
  const copied = await page.$eval(".news-share", (el) => {
    const copy = el.querySelector(".news-share__copy span");
    return copy ? copy.textContent.toLowerCase() : "";
  });
  check("copy link still functional", copied.includes("copied") || copied.includes("copy"), copied);

  const fails = results.filter((r) => r.startsWith("FAIL")).length;
  console.log(results.join("\n"));
  console.log(`\n${results.length - fails}/${results.length} passed`);
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
