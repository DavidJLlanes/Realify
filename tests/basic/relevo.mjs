/* ═══════════════════════════════════════════════════════════════
   PRUEBA · RELEVO DE FOTOS POR EL SERVIDOR (iPhone con las apps instaladas)
   Simula el iPhone: navigator.standalone y DOS contextos de navegador distintos (cada app con su propio almacenamiento, como iOS),
   con el servidor real (server/traspaso/traspaso.py) detrás de /api/traspaso/. Comprueba: la primera vez Basic enseña un código y
   Realify lo pide y recibe la foto; después el paso es automático en los dos sentidos, sin código, sin ventanas nuevas ni navegación;
   y el buzón se vacía al entregar.
   Uso: node tests/basic/relevo.mjs   (necesita python3)   Salidas: OK / FALLO y código de salida.
   ═══════════════════════════════════════════════════════════════ */
import path from "node:path";
import { spawn } from "node:child_process";
import { abrir, RAIZ } from "../ia/lib/navegador.mjs";

const fallos = [], exige = (c, m) => { if (!c) fallos.push(m); };
const FOTO = path.join(RAIZ, "assets/skies", "atardecer-dorado.jpg");
const PUERTO = 18767 + Math.floor(Math.random() * 1000);
const py = spawn("python3", [path.join(RAIZ, "server/traspaso/traspaso.py")], { env: { ...process.env, TRASPASO_PORT: String(PUERTO) }, stdio: ["ignore", "ignore", "pipe"] });
await new Promise((ok, mal) => { py.stderr.once("data", ok); py.once("exit", c => mal(new Error("traspaso.py salió con " + c))); });
const API = `http://127.0.0.1:${PUERTO}`;

/* ── El servicio solo: el buzón se vacía al leerlo y rechaza identificadores raros ── */
{
  const id = "0123456789abcdef0123456789abcdef";
  exige((await fetch(`${API}/api/traspaso/buzon/${id}`, { method: "PUT", body: new Uint8Array(64) })).status === 204, "servicio: no acepta una foto");
  exige((await fetch(`${API}/api/traspaso/buzon/${id}`)).status === 200, "servicio: no entrega la foto");
  exige((await fetch(`${API}/api/traspaso/buzon/${id}`)).status === 204, "servicio: la foto no se borra al entregarla");
  exige((await fetch(`${API}/api/traspaso/buzon/../../etc`)).status === 404, "servicio: acepta rutas raras");
  exige((await fetch(`${API}/api/traspaso/par/canjear`, { method: "POST", body: JSON.stringify({ codigo: "000000", para: "basic" }) })).status === 404, "servicio: canjea un código inexistente");
}

const { page: arranque, errs, cerrar } = await abrir("escritorio");
const base = arranque.url().replace(/\/[^/]*$/, "/");
const navegador = arranque.context().browser();
await arranque.close();

/* Cada app en su contexto (almacenamiento aislado), con el iPhone instalado simulado y /api/traspaso/ hacia el servicio real. */
async function app(ruta) {
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  await ctx.addInitScript(() => Object.defineProperty(navigator, "standalone", { value: true }));
  await ctx.route("**/api/traspaso/**", async r => {
    const q = r.request(), u = new URL(q.url());
    const res = await fetch(API + u.pathname + u.search, { method: q.method(), headers: { "Content-Type": q.headers()["content-type"] || "application/octet-stream", "X-Real-IP": "10.0.0.7" }, body: ["GET", "HEAD"].includes(q.method()) ? undefined : q.postDataBuffer() });
    await r.fulfill({ status: res.status, headers: Object.fromEntries(res.headers), body: Buffer.from(await res.arrayBuffer()) });
  });
  let ventanas = 0; ctx.on("page", () => ventanas++);
  const p = await ctx.newPage();
  p.on("pageerror", e => errs.push(ruta + ": " + e.message));
  await p.goto(base + ruta); await p.waitForTimeout(1500);
  return { p, ctx, ventanas: () => ventanas - 1 };
}
const fotoBasic = b => b.evaluate(async () => { const S = await import("/basic/js/app/session.js"); const o = S.original(); return o && { w: o.width, h: o.height }; });
const docReal = p => p.evaluate(async () => { const D = await import("/js/core/doc.js"); return D.doc.open ? { w: D.doc.w, h: D.doc.h } : null; });
const avisos = async p => (await p.locator(".aviso, #toast, #stMsg").allTextContents().catch(() => [])).join(" | ");
const despertar = p => p.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
/* Espera hasta que se cumpla algo (con red lenta o la máquina cargada, una espera fija se queda corta). */
const esperar = async (f, ms = 20000) => { for (const t0 = Date.now(); Date.now() - t0 < ms;) { const v = await f(); if (v) return v; await new Promise(r => setTimeout(r, 300)); } return null; };

const B = await app("basic/"), R = await app("");

/* ── 1. Primera vez: Basic → Realify con código ── */
await B.p.setInputFiles("input[type=file]", FOTO); await B.p.waitForTimeout(1500);
const f0 = await fotoBasic(B.p);
const urlB = B.p.url();
await B.p.getByLabel("Más opciones").click();
await B.p.locator(".menu-op:has-text('Abrir en Realify')").click();
await B.p.locator(".hoja-codigo .codigo-grande").waitFor({ timeout: 15000 }).catch(() => {});
const codigo = (await B.p.locator(".hoja-codigo .codigo-grande").textContent().catch(() => "")).replace(/\D/g, "");
exige(/^\d{6}$/.test(codigo), "1ª vez: Basic no enseña el código de emparejamiento (" + codigo + ") · " + await avisos(B.p));
exige(B.p.url() === urlB && B.ventanas() === 0, "1ª vez: Basic no debe abrir ventanas ni navegar");
await B.p.locator(".hoja-codigo button").click();

await despertar(R.p);
const campo = R.p.locator(".modal input[inputmode=numeric]");
await campo.waitFor({ timeout: 8000 }).catch(() => {});
exige(await campo.count() === 1, "1ª vez: Realify no pide el código");
if (await campo.count()) {
  await campo.fill("123"); await R.p.locator(".modal-foot button.primary").click();          // código malo: lo vuelve a pedir con aviso
  await R.p.waitForTimeout(800);
  exige(/no vale/.test(await R.p.locator(".modal").textContent().catch(() => "")), "1ª vez: con un código malo no avisa");
  await R.p.locator(".modal input[inputmode=numeric]").fill(codigo.slice(0, 3) + " " + codigo.slice(3));
  await R.p.locator(".modal-foot button.primary").click();
}
await R.p.waitForTimeout(5000);
const d1 = await docReal(R.p);
exige(d1 && d1.w === f0.w && d1.h === f0.h, "1ª vez: la foto no llegó a Realify con su tamaño " + JSON.stringify([f0, d1]));

/* ── 2. Ya emparejadas: Realify → Basic, automático ── */
const nuevoDoc = (w, h) => R.p.evaluate(async ([w, h]) => { const D = await import("/js/core/doc.js"); D.newDoc(w, h, { name: "ios" }); const l = D.addLayer({ name: "Fondo" }); l.ctx.fillStyle = "#2a7"; l.ctx.fillRect(0, 0, w, h); }, [w, h]);
await nuevoDoc(300, 200);
const urlR = R.p.url();
await R.p.evaluate(async () => (await import("/js/core/commands.js")).run("file.toBasic"));
await R.p.waitForTimeout(4000);
exige(await R.p.locator(".modal").count() === 0, "2ª: Realify no debe volver a pedir ni enseñar código");
exige(/Foto enviada/.test(await avisos(R.p)), "2ª: falta el aviso «Foto enviada» en Realify · " + await avisos(R.p));
exige(R.p.url() === urlR && R.ventanas() === 0, "2ª: Realify no debe abrir ventanas ni navegar");
await despertar(B.p); await B.p.waitForTimeout(4000);
const f1 = await fotoBasic(B.p);
exige(f1 && f1.w === 300 && f1.h === 200, "2ª: Basic no recibió la foto sola " + JSON.stringify(f1));

/* ── 3. Basic → Realify otra vez: sin código ── */
await nuevoDoc(50, 40);
await B.p.evaluate(async () => (await import("/basic/js/app/traspaso.js")).enviarARealify(() => {}));
await B.p.waitForTimeout(3000);
exige(await B.p.locator(".hoja-codigo").count() === 0, "3ª: Basic vuelve a pedir emparejar");
await despertar(R.p); await R.p.waitForTimeout(5000);
const d3 = await docReal(R.p);
exige(d3 && d3.w === 300 && d3.h === 200, "3ª: Realify no recibió la foto sola " + JSON.stringify(d3));

/* ── 4. Emparejar a mano desde los menús (Realify perdió la clave): Basic enseña el código y Realify lo escribe ── */
await R.p.evaluate(() => localStorage.removeItem("realify-relevo:realify"));
await B.p.getByLabel("Más opciones").click();
const opsB = await B.p.locator(".menu-op").allTextContents();
exige(opsB.includes("Emparejar con Realify Pro"), "4ª: falta «Emparejar con Realify» en el menú de Basic " + opsB.join("|"));
await B.p.locator(".menu-op:has-text('Emparejar con Realify')").click();
await B.p.locator(".hoja-codigo button:has-text('Enseñar código')").click();
await B.p.locator(".hoja-codigo .codigo-grande").waitFor({ timeout: 8000 }).catch(() => {});
const cod2 = (await B.p.locator(".hoja-codigo .codigo-grande").textContent().catch(() => "")).replace(/\D/g, "");
exige(/^\d{6}$/.test(cod2), "4ª: Basic no enseña código desde el menú");
await B.p.locator(".hoja-codigo button").click();
const habil = await R.p.evaluate(async () => (await import("/js/core/commands.js")).enabled("file.pairBasic"));
exige(habil, "4ª: «Emparejar con Realify Basic» no está activo en el iPhone instalado");
R.p.evaluate(async () => (await import("/js/core/commands.js")).run("file.pairBasic"));
await R.p.locator(".modal-foot button:has-text('Escribir código')").click({ timeout: 8000 }).catch(() => fallos.push("4ª: Realify no ofrece «Escribir código»"));
await R.p.locator(".modal input[inputmode=numeric]").fill(cod2).catch(() => {});
await R.p.locator(".modal-foot button.primary").click().catch(() => {});
await R.p.waitForTimeout(1500);
exige(await R.p.evaluate(() => !!localStorage.getItem("realify-relevo:realify")), "4ª: Realify no guardó la clave al escribir el código");
await nuevoDoc(50, 40);
await B.p.evaluate(async () => (await import("/basic/js/app/traspaso.js")).enviarARealify(() => {}));
await B.p.waitForTimeout(3000);
await despertar(R.p); await esperar(async () => { await despertar(R.p); const d = await docReal(R.p); return d && d.w === 300 ? d : null; }).catch(() => null);
const d4 = await docReal(R.p);
exige(d4 && d4.w === 300, "4ª: tras emparejar a mano, la foto no llegó a Realify " + JSON.stringify(d4));

if (errs.length) fallos.push("errores de página: " + errs.join(" | "));
await B.ctx.close(); await R.ctx.close(); await cerrar(); py.kill();
console.log(fallos.length ? "FALLO\n  - " + fallos.join("\n  - ") : "OK");
process.exit(fallos.length ? 1 : 0);
