#!/usr/bin/env node
/**
 * Glovebox App Store screenshot driver - fully autonomous. No Mac/sim/sudo/taps.
 *
 * Logs in, builds a real Sunshine Coast -> Brisbane trip in the web app
 * (pixel-identical to the Capacitor webview), then captures each hero screen at
 * exact Apple-required device dimensions.
 *
 *   iPhone 6.9" : 1290 x 2796  (CSS 430x932 @ DSF 3)   [Apple also accepts 1320x2868]
 *   iPad 13"    : 2064 x 2752  (CSS 1032x1376 @ DSF 2)
 *
 * Usage: NODE_PATH=<agent>/node_modules node scripts/screenshot-driver.cjs
 * Output: ./appstore-screenshots/<device>/<NN>-<screen>.png
 */
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const BASE = process.env.GB_BASE || "https://glovebox.ecodia.au";
const EMAIL = process.env.GB_EMAIL || "apple@ecodia.au";
const PASSWORD = process.env.GB_PASSWORD || "appleecodia";
const CHROME = process.env.GB_CHROME || "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe";
const OUT = path.resolve(__dirname, "..", "appstore-screenshots");

const DEVICES = [
  { name: "iphone-6.9", w: 430, h: 932, dsf: 3 },
  { name: "ipad-13", w: 1032, h: 1376, dsf: 2 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(page, dir, name) {
  const p = path.join(dir, name + ".png");
  await page.screenshot({ path: p });
  console.log("  SHOT", name);
}

async function dismissModal(page) {
  try {
    const d = await page.evaluate(() => {
      const t = [...document.querySelectorAll("button, a")]
        .find((e) => /let'?s go|get started/i.test(e.textContent || ""));
      if (t) { t.click(); return true; }
      return false;
    });
    if (d) await sleep(1500);
  } catch {}
}

/** Type into an input by placeholder, then pick the autocomplete row that best
 *  matches preferRe (falls back to the first row). */
async function searchAndPick(page, placeholderRe, query, preferRe) {
  const ok = await page.evaluate((reStr) => {
    const re = new RegExp(reStr, "i");
    const inp = [...document.querySelectorAll("input")].find((e) => re.test(e.placeholder || ""));
    if (!inp) return false;
    inp.focus(); inp.click();
    return true;
  }, placeholderRe.source);
  if (!ok) { console.log("    input not found:", placeholderRe); return false; }
  await sleep(400);
  await page.keyboard.type(query, { delay: 40 });
  await sleep(2800); // debounced geocode

  const picked = await page.evaluate((q, preferStr) => {
    const prefer = preferStr ? new RegExp(preferStr, "i") : null;
    let rows = [...document.querySelectorAll(".trip-list-row")];
    if (!rows.length) {
      rows = [...document.querySelectorAll("button")].filter((b) => {
        const t = (b.textContent || "").toLowerCase();
        return t && q.toLowerCase().split(" ").some((w) => w.length > 3 && t.includes(w));
      });
    }
    if (!rows.length) return null;
    let target = rows[0];
    if (prefer) {
      const m = rows.find((r) => prefer.test(r.textContent || ""));
      if (m) target = m;
    }
    target.click();
    return (target.textContent || "").trim().slice(0, 40);
  }, query, preferRe ? preferRe.source : "");
  console.log("    picked:", picked || "NONE");
  await sleep(1800);
  return !!picked;
}

async function buildTrip(page) {
  await page.goto(BASE + "/new", { waitUntil: "networkidle2", timeout: 45000 }).catch(()=>{});
  await sleep(4000);
  await dismissModal(page);
  await sleep(1000);
  // Some builds gate the inputs behind a first tap; click the start input region.
  await searchAndPick(page, /starting point|origin|start/i, "Caloundra Queensland", /caloundra/i);
  await searchAndPick(page, /destination|where to|end/i, "Brisbane Queensland", /brisbane/i);
  await sleep(1500);
  // Save & Go -> builds the route + routes to /trip.
  const saved = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((e) => /save\s*&\s*go|save and go/i.test(e.textContent || ""));
    if (b) { b.click(); return true; }
    return false;
  });
  console.log("  save&go clicked:", saved);
  // Route build can take a while (geometry + overlays).
  await sleep(12000);
  await dismissModal(page);
  console.log("  post-build url:", page.url());
}

async function run() {
  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: CHROME,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--hide-scrollbars"],
  });

  for (const dev of DEVICES) {
    const dir = path.join(OUT, dev.name);
    fs.mkdirSync(dir, { recursive: true });
    const ctx = await browser.createBrowserContext();
    await ctx.overridePermissions(BASE, ["geolocation"]);
    const page = await ctx.newPage();
    await page.setViewport({ width: dev.w, height: dev.h, deviceScaleFactor: dev.dsf, isMobile: true, hasTouch: true });
    await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148");
    await page.setGeolocation({ latitude: -26.68, longitude: 153.137 });

    console.log(`\n=== ${dev.name} (${dev.w*dev.dsf}x${dev.h*dev.dsf}) ===`);

    // 1. Welcome / login (hero)
    await page.goto(BASE + "/login", { waitUntil: "networkidle2", timeout: 45000 }).catch(()=>{});
    await sleep(2500);
    await shot(page, dir, "01-welcome");

    // Sign in (toggle out of signup mode first).
    try {
      await page.waitForSelector('input[type="email"]', { timeout: 8000 });
      await page.evaluate(() => { const t=[...document.querySelectorAll("button,a")].find(e=>/sign in/i.test(e.textContent||"")); if(t)t.click(); });
      await sleep(800);
      await page.type('input[type="email"]', EMAIL, { delay: 25 });
      await page.type('input[type="password"]', PASSWORD, { delay: 25 });
      await page.evaluate(() => { const f=document.querySelector("form"); const b=f&&f.querySelector('button[type=submit]'); if(b)b.click(); else f&&f.requestSubmit(); });
      await sleep(6000);
      console.log("  post-login url:", page.url());
    } catch (e) { console.log("  LOGIN FAILED:", e.message); }
    await dismissModal(page);

    // 2. Build the real trip -> lands on /trip with route drawn.
    await buildTrip(page);
    await sleep(2000);
    await shot(page, dir, "02-trip-map");

    // 3. Guide (active trip -> real companion). Send one message so the chat
    // shows a live AI response (the product's headline differentiator).
    await page.goto(BASE + "/guide", { waitUntil: "networkidle2", timeout: 45000 }).catch(()=>{});
    await sleep(3500);
    await dismissModal(page);
    try {
      const asked = await page.evaluate(() => {
        const inp = [...document.querySelectorAll("input, textarea")]
          .find((e) => /ask about your route|ask anything|message/i.test(e.placeholder || ""));
        if (!inp) return false;
        inp.focus(); inp.click();
        return true;
      });
      if (asked) {
        await page.keyboard.type("Where's a good place to stop for lunch?", { delay: 30 });
        await sleep(400);
        // Submit: press Enter, or click the send button.
        await page.keyboard.press("Enter");
        await page.evaluate(() => {
          const f = document.querySelector("form");
          if (f) f.requestSubmit && f.requestSubmit();
        });
        console.log("  guide question sent, awaiting AI reply...");
        await sleep(12000); // Sonnet round-trip + render
      }
    } catch (e) { console.log("  guide-ask failed:", e.message); }
    await shot(page, dir, "03-guide");

    // 4. SOS
    await page.goto(BASE + "/sos", { waitUntil: "networkidle2", timeout: 45000 }).catch(()=>{});
    await sleep(2500);
    await dismissModal(page);
    await shot(page, dir, "04-sos");

    await page.close();
    await ctx.close();
  }

  await browser.close();
  console.log("\nDONE.", OUT);
}

run().catch((e) => { console.error("FATAL", e); process.exit(1); });
