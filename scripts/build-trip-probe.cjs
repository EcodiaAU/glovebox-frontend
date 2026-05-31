#!/usr/bin/env node
/**
 * Probe: log in, go to /new, build a Sunshine Coast -> Brisbane trip, save.
 * Verbose + screenshots each step so we can see the real DOM and adapt.
 */
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const BASE = "https://glovebox.ecodia.au";
const EMAIL = "apple@ecodia.au";
const PASSWORD = "appleecodia";
const DBG = path.resolve(__dirname, "..", "appstore-screenshots", "_debug");
fs.mkdirSync(DBG, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let step = 0;
async function snap(page, tag) {
  step++;
  const p = path.join(DBG, `${String(step).padStart(2, "0")}-${tag}.png`);
  await page.screenshot({ path: p });
  console.log("  snap", p);
}

async function dump(page, label) {
  // Print the interactive elements currently on screen.
  const els = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll("input, button, [role=button], .trip-list-row, .trip-input").forEach((e) => {
      const r = e.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      out.push({
        tag: e.tagName.toLowerCase(),
        cls: (e.className || "").toString().slice(0, 40),
        ph: e.placeholder || "",
        txt: (e.textContent || "").trim().slice(0, 40),
        x: Math.round(r.x), y: Math.round(r.y),
      });
    });
    return out;
  });
  console.log(`  [${label}] ${els.length} interactive els:`);
  els.slice(0, 25).forEach((e) => console.log("    ", JSON.stringify(e)));
}

async function run() {
  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--hide-scrollbars"],
  });
  const ctx = await browser.createBrowserContext();
  await ctx.overridePermissions(BASE, ["geolocation"]);
  const page = await ctx.newPage();
  await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148");
  await page.setGeolocation({ latitude: -26.68, longitude: 153.137 });

  // login
  await page.goto(BASE + "/login", { waitUntil: "networkidle2" }).catch(()=>{});
  await sleep(2000);
  await page.waitForSelector('input[type="email"]', { timeout: 8000 });
  await page.evaluate(() => { const t = [...document.querySelectorAll("button,a")].find(e=>/sign in/i.test(e.textContent||"")); if(t)t.click(); });
  await sleep(800);
  await page.type('input[type="email"]', EMAIL, { delay: 20 });
  await page.type('input[type="password"]', PASSWORD, { delay: 20 });
  await page.evaluate(() => { const f=document.querySelector("form"); const b=f&&f.querySelector('button[type=submit]'); if(b)b.click(); else f&&f.requestSubmit(); });
  await sleep(6000);
  console.log("post-login:", page.url());

  // dismiss welcome
  await page.evaluate(() => { const t=[...document.querySelectorAll("button,a")].find(e=>/let'?s go|get started/i.test(e.textContent||"")); if(t)t.click(); });
  await sleep(2000);

  // go to /new
  await page.goto(BASE + "/new", { waitUntil: "networkidle2" }).catch(()=>{});
  await sleep(4000);
  await snap(page, "new-initial");
  await dump(page, "/new initial");

  // Try to open the first stop search: click whatever looks like "Where to" / search / add stop
  const opened = await page.evaluate(() => {
    const cands = [...document.querySelectorAll("input, button, [role=button]")];
    // Prefer a visible search input
    const inp = cands.find(e => e.tagName === "INPUT" && /where|search|stop|destination/i.test(e.placeholder||""));
    if (inp) { inp.focus(); inp.click(); return "input:" + (inp.placeholder||""); }
    const btn = cands.find(e => /where to|add stop|search|destination|start|origin/i.test(e.textContent||""));
    if (btn) { btn.click(); return "btn:" + (btn.textContent||"").trim().slice(0,30); }
    return "none";
  });
  console.log("opened search via:", opened);
  await sleep(2000);
  await snap(page, "after-open-search");
  await dump(page, "after open");

  await browser.close();
  console.log("PROBE DONE - inspect", DBG);
}
run().catch((e)=>{console.error("FATAL", e); process.exit(1);});
