/* ═══════════════════════════════════════════════════════════════
   EDITOR DE VÍDEO · EDITOR A PANTALLA COMPLETA (orquestador)
   Monta el armazón común (bridge/ui), la vista previa, la barra de transporte, la línea de tiempo y los paneles. Guarda el proyecto en el historial (deshacer/rehacer), abre los vídeos con
   abrirMedio y los entrega al motor por su id. No calcula píxeles ni edita a mano: llama a timeline/ops.js, render/ y ui/exportar.js. Entradas: ninguna. Salida: { cerrar() }.
   Atajos: Espacio reproduce/pausa, S divide en el cabezal, Supr borra el clip elegido, ←/→ un fotograma.
   ═══════════════════════════════════════════════════════════════ */
import { createShell, ensureShellStyles, pickFiles, toast, download, isMobile } from "../bridge/ui.js";
import { crearProyecto, crearPista, duracionProyecto, finClip, buscarClip } from "../project/modelo.js";
import { crearHistorial } from "../timeline/historial.js";
import * as T from "../timeline/ops.js";
import { vistaInicial, zoomEn } from "../timeline/vista.js";
import { abrirMedio } from "../media/importar.js";
import { crearReproductor } from "../render/reproductor.js";
import { tamanoPrevia, FORMATOS_SALIDA } from "../render/limites.js";
import { motorDom } from "./motor-dom.js";
import { crearLinea, etiquetaTiempo } from "./linea.js";
import { construirPanel } from "./panel.js";
import { exportarProyecto } from "./exportar.js";

export function abrirEditor(){
  ensureShellStyles(); document.head.querySelector("#vid-css") || document.head.appendChild(Object.assign(document.createElement("link"), { id: "vid-css", rel: "stylesheet", href: new URL("../css/editor.css", import.meta.url).href }));
  let hist = crearHistorial(crearProyecto()), sel = null, vista = vistaInicial(10, 600), motor = null, rep = null, exportando = null;
  const lectores = new Map(), previa = document.createElement("canvas"), p = () => hist.actual();
  const sh = createShell({ title: "Vídeo", subtitle: "", applyLabel: "Exportar", cls: "vid", onApply: () => exportar(), onCancel: () => cerrar(), onUndo: () => cambiar(() => hist.deshacer()), onRedo: () => cambiar(() => hist.rehacer()) });
  sh.setApplyEnabled(false);

  /* ── Disposición: barra de transporte + línea de tiempo bajo la vista previa ── */
  const zona = document.createElement("div"); zona.className = "vid-zona";
  zona.innerHTML = `<div class="vid-barra"><button data-a="inicio" aria-label="Ir al principio">⏮</button><button data-a="play" aria-label="Reproducir">▶</button><span class="vid-t">00:00.0 / 00:00.0</span><span class="vid-sp"></span>
    <button data-a="anadir">＋ Vídeo</button><button data-a="dividir" aria-label="Dividir en el cabezal">✂</button><button data-a="borrar" aria-label="Borrar clip">🗑</button><button data-a="menos" aria-label="Alejar">−</button><button data-a="mas" aria-label="Acercar">＋</button></div><div class="vid-linea"></div>`;
  sh.root.querySelector(".fsp-work").after(zona);
  const q = s => zona.querySelector(s), tEl = q(".vid-t");
  sh.setEmpty(`<button type="button" class="primary" data-a="anadir">＋ Añadir vídeo</button><p>MP4, MOV o WebM. Se queda en tu dispositivo.</p>`).querySelector("button").onclick = anadir;

  const lectorDe = async (id, ancho) => { const l = await lectores.get(id).abrir(ancho); return { fotograma: t => l.fotograma(t), cerrar(){} }; };   // el editor es el dueño de los lectores
  function reiniciarMotor(){
    rep?.cerrar(); motor?.cerrar(); const { ancho, alto } = tamanoPrevia(p().salida); previa.width = ancho; previa.height = alto;
    motor = motorDom({ proyecto: p, lectorDe });
    rep = crearReproductor({ motor, duracion: () => duracionProyecto(p()), ancho, alto, ahora: () => performance.now(), programar: f => requestAnimationFrame(f),
      pintar: (l) => { const x = previa.getContext("2d"); x.drawImage(l, 0, 0); sh.setView(previa, true); }, alCambiar: refrescarBarra });
    rep.buscar(Math.min(rep.tiempo(), duracionProyecto(p())));
  }
  function refrescarBarra(){
    const d = duracionProyecto(p()); tEl.textContent = `${etiquetaTiempo(rep ? rep.tiempo() : 0)} / ${etiquetaTiempo(d)}`;
    q('[data-a="play"]').textContent = rep?.reproduciendo() ? "⏸" : "▶"; sh.setUndo(hist.puedeDeshacer(), hist.puedeRehacer()); sh.setApplyEnabled(d > 0 && !exportando);
    sh.setEmpty(d > 0 ? null : undefined); sh.setSubtitle(d > 0 ? `${p().salida.ancho}×${p().salida.alto} · ${p().salida.fps} fps` : ""); linea.dibujar();
  }
  function cambiar(fn, motorNuevo = false){
    const antes = p(); try{ fn(); }catch(e){ return toast(e.message || String(e)); } if(p() === antes) return;
    if(sel && !buscarClip(p(), sel)) sel = null;
    const resCambio = antes.salida !== p().salida; if(motorNuevo || resCambio || antes.medios !== p().medios) reiniciarMotor(); else rep.buscar(rep.tiempo());
    refrescarBarra(); panel.actualizar();
  }
  const hacer = (fn, etiqueta) => cambiar(() => hist.hacer(fn, etiqueta));

  const linea = crearLinea({ contenedor: q(".vid-linea"), obtener: () => ({ p: p(), sel, t: rep ? rep.tiempo() : 0 }), vista: () => vista, alVista: v => { vista = v; linea.dibujar(); },
    alBuscar: t => rep?.buscar(t), alSeleccionar: id => { sel = id; panel.actualizar(); linea.dibujar(); }, alMover: (id, ini, pista) => hacer(pp => T.mover(pp, id, ini, pista), "Mover") });
  const panel = construirPanel({ sh, obtener: () => ({ p: p(), sel }), hacer, formatos: FORMATOS_SALIDA, alFormato: f => hacer(pp => ({ ...pp, salida: { ...pp.salida, ...f } }), "Formato"), alContenedor: c => { contenedor = c; } });
  let contenedor = "mp4";

  /* ── Acciones ── */
  async function anadir(){
    const archivos = await pickFiles({ accept: "video/*,.mp4,.mov,.webm,.mkv,.m4v", gallery: false, multiple: true }); if(!archivos.length) return;
    for(const f of archivos){
      sh.setBusy(`Abriendo ${f.name}…`);
      try{
        const r = await abrirMedio(f, { ancho: tamanoPrevia(p().salida).ancho }), id = r.medio.huella + "#" + Object.keys(p().medios).length; let anchos = new Map([[tamanoPrevia(p().salida).ancho, r.lector]]);
        lectores.set(id, { archivo: f, abrir: async ancho => { if(!anchos.has(ancho)) anchos.set(ancho, (await abrirMedio(f, { ancho })).lector); return anchos.get(ancho); }, cerrar(){ anchos.forEach(l => l.cerrar()); } });
        hacer(pp => {
          let q2 = { ...pp, medios: { ...pp.medios, [id]: r.medio } }; if(!q2.pistas.some(t => t.tipo === "video")) q2 = { ...q2, pistas: [...q2.pistas, crearPista("video")] };
          if(!Object.keys(pp.medios).length) q2 = { ...q2, salida: { ...q2.salida, fps: [24, 25, 30, 50, 60].includes(Math.round(r.medio.fps)) ? Math.round(r.medio.fps) : 30, ...(r.medio.ancho > r.medio.alto ? FORMATOS_SALIDA.horizontal : FORMATOS_SALIDA.vertical) } };
          const pista = q2.pistas.find(t => t.tipo === "video"); return T.anadirClip(q2, pista.id, id, {});
        }, "Añadir vídeo");
      }catch(e){ toast(e.message || String(e), "error"); }
    }
    sh.setBusy(""); if(duracionProyecto(p()) > 0){ vista = vistaInicial(duracionProyecto(p()), zona.clientWidth - 8); linea.dibujar(); }
  }
  const dividir = () => { const c = sel ? buscarClip(p(), sel) : null, t = rep.tiempo(); const alvo = c ? c.clip : p().pistas.flatMap(x => x.clips).find(k => t > k.inicio && t < finClip(k)); if(!alvo) return toast("Pon el cabezal sobre un clip"); hacer(pp => T.dividir(pp, alvo.id, t), "Dividir"); };
  const borrar = () => sel && hacer(pp => T.eliminar(pp, sel), "Borrar");
  async function exportar(){
    if(exportando) return; exportando = new AbortController(); sh.setApplyEnabled(false); rep.pause();
    try{
      const r = await exportarProyecto({ proyecto: p(), movil: isMobile(), contenedor, senal: exportando.signal, alProgreso: (n, tot) => sh.setBusy(`Exportando ${Math.round(n / tot * 100)} %`),
        motorDe: (pr, ancho) => motorDom({ proyecto: () => pr, lectorDe, cacheMax: 4 }) });
      download(r.blob, r.nombre); toast(`Vídeo exportado (${r.ancho}×${r.alto}, ${r.codec})`);
    }catch(e){ if(!e.cancelado) toast(e.message || String(e), "error"); }
    exportando = null; sh.setBusy(""); refrescarBarra();
  }
  function cerrar(){ exportando?.abort(); rep?.cerrar(); motor?.cerrar(); for(const l of lectores.values()) l.cerrar(); document.removeEventListener("keydown", teclas, true); sh.close(); }
  function teclas(e){
    if(sh.closed || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return; const f = 1 / p().salida.fps;
    if(e.key === " "){ e.preventDefault(); rep.alternar(); } else if(e.key === "s" || e.key === "S") dividir(); else if(e.key === "Delete" || e.key === "Backspace") borrar();
    else if(e.key === "ArrowLeft") rep.buscar(rep.tiempo() - f); else if(e.key === "ArrowRight") rep.buscar(rep.tiempo() + f);
  }
  document.addEventListener("keydown", teclas, true);
  zona.addEventListener("click", e => { const a = e.target.closest("[data-a]")?.dataset.a; if(!a) return; ({ inicio: () => rep.buscar(0), play: () => rep.alternar(), anadir, dividir, borrar,
    menos: () => { vista = zoomEn(vista, 0.8, zona.clientWidth / 2); linea.dibujar(); }, mas: () => { vista = zoomEn(vista, 1.25, zona.clientWidth / 2); linea.dibujar(); } })[a]?.(); });
  new ResizeObserver(() => linea.dibujar()).observe(q(".vid-linea"));
  reiniciarMotor(); refrescarBarra();
  window.__video = { p, sel: () => sel, rep: () => rep, hist };   // para pruebas
  return { cerrar };
}
