/* ═══════════════════════════════════════════════════════════════
   PANORÁMICA DESDE FOTOS · INTERFAZ (MOTOR OPENCV DE PRUEBA1)
   ═══════════════════════════════════════════════════════════════ */

import { createShell, decodePhoto, pickFiles, scaledCanvas } from "../../js/ui/kit/fsshell.js";
import { toast } from "../../js/core/toast.js";
import { premiumSwitch, premiumPref } from "../../js/ui/kit/premium.js";
import { escText as esc } from "../../js/core/util/html.js";

const MAX_PHOTOS = 25;

export function openPanoramaEditor({ current = null, onAccept }){
  let photos = [];
  let seq = 0, closed = false, applying = false;
  let autoCrop = true;

  const S = {
    premium: premiumPref.get("panorama")
  };

  const sh = createShell({
    title: "Panorámica desde fotos",
    subtitle: "Arrastra tus fotos para unirlas con OpenCV",
    applyLabel: "Crear panorámica con OpenCV",
    cls: "fsp-panorama",
    onCancel: close,
    onApply: apply
  });

  const premium = sh.addAction(premiumSwitch({
    checked: S.premium,
    title: "Procesado panorámico Premium",
    onChange: on => {
      S.premium = on;
      premiumPref.set("panorama", on);
      sh.setClass("is-premium", on);
    }
  }));
  sh.setClass("is-premium", S.premium);

  sh.setApplyEnabled(false);

  const stage = sh.stage;
  stage.style.display = "flex";
  stage.style.flexDirection = "column";
  stage.style.alignItems = "center";
  stage.style.justifyContent = "center";
  stage.style.padding = "24px";
  stage.style.overflow = "auto";
  stage.style.boxSizing = "border-box";

  stage.addEventListener("dragover", e => { e.preventDefault(); stage.classList.add("pano-dragover"); });
  stage.addEventListener("dragleave", e => { e.preventDefault(); stage.classList.remove("pano-dragover"); });
  stage.addEventListener("drop", e => {
    e.preventDefault();
    stage.classList.remove("pano-dragover");
    const files = [...(e.dataTransfer?.files || [])].filter(f => /image\//i.test(f.type) || /\.(jpe?g|png|webp|avif|heic|tiff?)$/i.test(f.name));
    if(files.length) addPhotosFromFiles(files);
  });

  renderUI();

  function renderUI(){
    stage.innerHTML = "";

    if(photos.length === 0){
      sh.setApplyEnabled(false);
      sh.setSubtitle("Arrastra tus fotos para unirlas con OpenCV");

      const dropBox = document.createElement("div");
      dropBox.className = "fsp-pano-dropzone";
      dropBox.style.cssText = "border:2px dashed rgba(255,255,255,0.3);border-radius:16px;padding:3rem;text-align:center;cursor:pointer;max-width:600px;width:100%;box-sizing:border-box;background:rgba(255,255,255,0.03);";
      dropBox.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:48px;height:48px;margin:0 auto 12px;display:block;opacity:0.8;">
          <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/>
          <path d="M12 12v9"/>
          <path d="m16 16-4-4-4 4"/>
        </svg>
        <b style="font-size:16px;display:block;margin-bottom:6px;">Arrastra tus fotos aquí o haz clic para subir</b>
        <span style="font-size:13px;color:#8b949e;display:block;margin-bottom:16px;">Toma varias fotos en secuencia horizontal con un 30-50% de solape.</span>
        <button type="button" class="primary" style="padding:10px 20px;border-radius:8px;font-weight:600;background:#58a6ff;color:#0d1117;border:none;cursor:pointer;">Seleccionar archivos</button>
      `;
      dropBox.onclick = () => addPhotos();
      stage.appendChild(dropBox);

      if(current){
        const curBtn = document.createElement("button");
        curBtn.innerText = "Usar la imagen abierta en el editor";
        curBtn.style.cssText = "background:#21262d;color:#c9d1d9;border:1px solid #30363d;padding:10px 18px;border-radius:8px;cursor:pointer;margin-top:12px;";
        curBtn.onclick = () => addItems([{ canvas: current.canvas, name: current.name || "Capa activa" }]);
        stage.appendChild(curBtn);
      }
      return;
    }

    sh.setApplyEnabled(photos.length >= 2);
    sh.setSubtitle(`${photos.length} fotos cargadas · Listas para unir con OpenCV`);

    const container = document.createElement("div");
    container.style.cssText = "width:100%;max-width:1100px;display:flex;flex-direction:column;gap:16px;align-items:center;";

    const topBar = document.createElement("div");
    topBar.style.cssText = "width:100%;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;";
    topBar.innerHTML = `
      <div style="font-size:14px;color:#c9d1d9;font-weight:600;">Fotos en secuencia (${photos.length}):</div>
      <div style="display:flex;align-items:center;gap:14px;">
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:#c9d1d9;cursor:pointer;background:#21262d;padding:6px 12px;border-radius:6px;border:1px solid #30363d;">
          <input type="checkbox" id="chk-autocrop" ${autoCrop ? "checked" : ""} style="cursor:pointer;accent-color:#58a6ff;" />
          <span>Recortar bordes negros automáticamente</span>
        </label>
        <button type="button" id="btn-add-more" style="background:#21262d;color:#58a6ff;border:1px solid #30363d;padding:7px 14px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500;">+ Añadir más</button>
        <button type="button" id="btn-clear-all" style="background:#21262d;color:#f85149;border:1px solid #30363d;padding:7px 14px;border-radius:6px;cursor:pointer;font-size:13px;">Limpiar todo</button>
      </div>
    `;
    container.appendChild(topBar);

    const grid = document.createElement("div");
    grid.style.cssText = "width:100%;display:grid;grid-template-columns:repeat(auto-fill, minmax(160px, 1fr));gap:16px;background:rgba(22, 27, 34, 0.8);border:1px solid #30363d;border-radius:12px;padding:16px;box-sizing:border-box;";

    photos.forEach((p, idx) => {
      const card = document.createElement("div");
      card.style.cssText = "background:#0d1117;border:1px solid #30363d;border-radius:8px;overflow:hidden;display:flex;flex-direction:column;position:relative;box-shadow:0 4px 12px rgba(0,0,0,0.3);";
      card.innerHTML = `
        <div style="position:relative;width:100%;height:110px;background:#000;">
          <img src="${p.thumb}" style="width:100%;height:100%;object-fit:cover;" />
          <span style="position:absolute;top:6px;left:6px;background:rgba(0,0,0,0.75);color:#58a6ff;font-weight:bold;font-size:11px;padding:2px 6px;border-radius:4px;border:1px solid rgba(88,166,255,0.4);">#${idx + 1}</span>
          <button type="button" data-del="${p.id}" style="position:absolute;top:6px;right:6px;background:rgba(248,81,73,0.85);color:#fff;border:none;border-radius:4px;width:22px;height:22px;cursor:pointer;font-weight:bold;font-size:12px;display:flex;align-items:center;justify-content:center;">✕</button>
        </div>
        <div style="padding:8px;font-size:11px;color:#8b949e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center;">
          ${esc(p.name)}
        </div>
      `;

      card.querySelector("[data-del]").onclick = (e) => {
        e.stopPropagation();
        photos = photos.filter(item => item.id !== p.id);
        renderUI();
      };

      grid.appendChild(card);
    });

    container.appendChild(grid);
    stage.appendChild(container);

    topBar.querySelector("#chk-autocrop").onchange = e => { autoCrop = e.target.checked; };
    topBar.querySelector("#btn-add-more").onclick = () => addPhotos();
    topBar.querySelector("#btn-clear-all").onclick = () => { photos = []; renderUI(); };
  }

  async function addItems(items){
    const room = MAX_PHOTOS - photos.length;
    if(room <= 0){
      toast(`Máximo alcanzado (${MAX_PHOTOS} fotos)`, "err");
      return;
    }
    const toAdd = items.slice(0, room);
    sh.setBusy("Cargando fotos…");

    try {
      for(const it of toAdd){
        const full = it.canvas || await decodePhoto(it.file, 3000);
        const id = ++seq;
        const thumb = scaledCanvas(full, 240).toDataURL("image/jpeg", 0.85);

        photos.push({
          id,
          name: it.name || `Foto ${id}`,
          file: it.file || null,
          full,
          thumb,
          w: full.width,
          h: full.height
        });
      }
      toast(toAdd.length === 1 ? "1 foto añadida" : `${toAdd.length} fotos añadidas`, "ok");
    } catch(err){
      toast("Error al cargar fotos: " + err.message, "err");
    } finally {
      sh.setBusy(null);
    }
    renderUI();
  }

  async function addPhotos(){
    const files = await pickFiles({ multiple: true });
    if(files.length) addPhotosFromFiles(files);
  }

  function addPhotosFromFiles(files){
    addItems(files.map(file => ({ file, name: file.name })));
  }

  function canvasToBlob(cv){
    return new Promise(resolve => cv.toBlob(resolve, "image/jpeg", 0.95));
  }

  async function apply(){
    if(applying || photos.length < 2) return;
    applying = true;
    sh.setApplyEnabled(false);
    sh.setBusy("Procesando con OpenCV (SIFT)... esto puede tardar unos segundos");

    try {
      const formData = new FormData();
      formData.append("autocrop", autoCrop ? "true" : "false");

      for(let i = 0; i < photos.length; i++){
        const p = photos[i];
        if(p.file){
          formData.append("files", p.file, p.file.name);
        } else {
          const blob = await canvasToBlob(p.full);
          formData.append("files", blob, `photo_${i}.jpg`);
        }
      }

      const res = await fetch("/api/stitch", {
        method: "POST",
        body: formData
      });

      if(!res.ok){
        throw new Error("El servidor respondió con código " + res.status);
      }

      const contentType = res.headers.get("content-type") || "";
      if(contentType.includes("application/json")){
        const json = await res.json();
        if(json.error) throw new Error(json.error);
      }

      const blob = await res.blob();
      const img = new Image();
      const objUrl = URL.createObjectURL(blob);
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = objUrl;
      });

      const finalCanvas = document.createElement("canvas");
      finalCanvas.width = img.naturalWidth || img.width;
      finalCanvas.height = img.naturalHeight || img.height;
      finalCanvas.getContext("2d").drawImage(img, 0, 0);
      URL.revokeObjectURL(objUrl);

      toast("¡Panorámica creada con éxito!", "ok");
      await onAccept(finalCanvas, { count: photos.length });
      close();
    } catch(err){
      toast("Error al crear panorámica: " + err.message, "err");
      sh.setBusy(null);
      sh.setApplyEnabled(true);
      applying = false;
    }
  }

  function close(){
    if(closed) return;
    closed = true;
    sh.close();
  }

  return { close };
}
