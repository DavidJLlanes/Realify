import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
  if(pathname === "/test"){
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/plugins/social-post/post.css"><div id="toast"></div>');
    return;
  }
  const file = path.resolve(root, "." + pathname);
  if(!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": file.endsWith(".css") ? "text/css" : "text/javascript" });
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({ channel: "msedge", args: ["--no-sandbox"] });
try{
  for(const mobile of [false, true]){
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, hasTouch: mobile, isMobile: mobile });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(e.stack || e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/test`);
    await page.evaluate(async () => {
      const c = document.createElement("canvas"); c.width = 80; c.height = 60;
      c.getContext("2d").fillStyle = "red"; c.getContext("2d").fillRect(0, 0, 80, 60);
      const { openPostEditor } = await import("/plugins/social-post/ui.js");
      window.editor = openPostEditor({ photo: c, onAccept: state => { window.result = state; } });
    });
    await page.evaluate(() => document.querySelector('[data-layout="free"]').click());
    const tray = mobile ? ".sp-tray-m" : ".sp-tray:not(.sp-tray-m)";
    await page.locator(`${tray} [data-photo="1"]`).click();
    if(mobile){
      await page.locator(".sp-prop-select").selectOption("c:shape");
      await page.locator(".sp-mobile-control select").selectOption("circle");
    } else await page.locator('.sp-props [data-shape="circle"]').first().click();
    const png = await page.evaluate(() => {
      const c = document.createElement("canvas"); c.width = 70; c.height = 50;
      c.getContext("2d").fillStyle = "blue"; c.getContext("2d").fillRect(0, 0, 70, 50);
      return c.toDataURL("image/png").split(",")[1];
    });
    await page.locator(".sp-file").setInputFiles({ name: "blue.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") });
    await page.locator(`${tray} [data-photo="2"]`).waitFor();
    await page.locator(`${tray} [data-photo="1"]`).click();
    await page.locator(`${tray} [data-photo="2"]`).click();
    if(mobile){
      const grips = await page.locator(".sp-tray-m .sp-thumb").evaluateAll(els => els.map(el => {
        const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }));
      await page.locator('[data-reorder="1"]').evaluate((el, target) => {
        const opts = { bubbles: true, pointerId: 13, pointerType: "touch", clientX: target.x, clientY: target.y };
        el.dispatchEvent(new PointerEvent("pointerdown", opts));
        el.dispatchEvent(new PointerEvent("pointermove", { ...opts, clientX: target.toX, clientY: target.toY }));
        el.dispatchEvent(new PointerEvent("pointerup", { ...opts, clientX: target.toX, clientY: target.toY }));
      }, { ...grips[0], toX: grips[1].x, toY: grips[1].y });
      assert.equal(await page.locator(".sp-tray-m .sp-thumb").first().getAttribute("data-photo"), "2");
      await page.locator(".sp-format-select").selectOption("ig-story");
      await page.locator(".sp-prop-select").selectOption("s:safeTop");
      await page.locator(".sp-mobile-control input[type=range]").evaluate(el => { el.value = "19"; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); });
    }
    await page.locator('[data-action="accept"]').click();
    await page.waitForFunction(() => !!window.result);
    const state = await page.evaluate(() => window.result);
    assert.equal(state.slots.length, 2);
    assert.equal(state.slots.find(s => s.photo === 1).shape, "circle");
    assert.equal(state.slots.find(s => s.photo === 2).shape, "rect");
    if(mobile){ assert.deepEqual(state.photos, [2, 1]); assert.deepEqual(state.slots.map(s => s.photo), [2, 1]); assert.equal(state.safeTop, 19); }
    assert.deepEqual(errors, []);
    console.log(`APTO collage ${mobile ? "móvil" : "escritorio"}`);
    await context.close();
  }
} finally { await browser.close(); server.close(); }
