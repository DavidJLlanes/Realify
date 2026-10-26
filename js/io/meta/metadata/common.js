/* ═══════════════════════════════════════════════════════════════
   metadata · piezas que usan varios bloques
   Parte de js/io/meta/metadata.js, que conserva la API y reexporta lo de aquí.
   ═══════════════════════════════════════════════════════════════ */

/* ── XMP ──────────────────────────────────────────────────────────── */
import { asciiAt as ascii, utf8 as enc } from "../../../core/util/text.js";
export { ascii, enc };

export const td = new TextDecoder("utf-8", { fatal: false });

export const NS = {
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#", dc: "http://purl.org/dc/elements/1.1/", xmp: "http://ns.adobe.com/xap/1.0/",
  photoshop: "http://ns.adobe.com/photoshop/1.0/", xmpRights: "http://ns.adobe.com/xap/1.0/rights/",
  Iptc4xmpCore: "http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/", exif: "http://ns.adobe.com/exif/1.0/", xmpNote: "http://ns.adobe.com/xmp/note/"
};

/* ── lectura del original y construcción de lo que se escribe ─────── */
export function concat(parts){
  let n = 0; for(const p of parts) n += p.length;
  const out = new Uint8Array(n); let o = 0;
  for(const p of parts){ out.set(p, o); o += p.length; }
  return out;
}
