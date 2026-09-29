/* ═══════════════════════════════════════════════════════════════
   FUNCIONES PREMIUM
   Icono de corona e interruptor reutilizables: cualquier plugin que
   tenga un modo de alta calidad lo enseña igual. De momento no hay
   ningún pago detrás: el interruptor sólo marca qué es Premium.
   ═══════════════════════════════════════════════════════════════ */

export const crownIcon = (size = 16) =>
  `<svg class="crown-icon" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">
     <path d="M3 18.5h18l-1.2-10.3-4.9 4.1L12 5 9.1 12.3 4.2 8.2 3 18.5z" fill="currentColor"/>
     <rect x="3" y="19.6" width="18" height="2.2" rx="1" fill="currentColor"/>
   </svg>`;

/* <label> con interruptor. `onChange(checked)` al cambiar. */
export function premiumSwitch({ checked = false, onChange = () => {}, label = "Premium", title = "Procesado de alta calidad (función Premium)" } = {}){
  const el = document.createElement("label");
  el.className = "premium-switch";
  el.title = title;
  el.innerHTML = `<input type="checkbox" role="switch"${checked ? " checked" : ""} aria-label="${label}">
    <span class="ps-track" aria-hidden="true"><span class="ps-thumb"></span></span>
    <span class="ps-crown">${crownIcon(15)}</span><span class="ps-label">${label}</span>`;
  const input = el.querySelector("input");
  input.addEventListener("change", () => onChange(input.checked));
  el.set = v => { input.checked = !!v; };
  el.input = input;
  return el;
}

/* Preferencia recordada por función (sólo en este navegador). */
export const premiumPref = {
  get(key){ try{ return localStorage.getItem("realify.premium." + key) === "1"; }catch{ return false; } },
  set(key, on){ try{ localStorage.setItem("realify.premium." + key, on ? "1" : "0"); }catch{} }
};
