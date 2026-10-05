/* ═══════════════════════════════════════════════════════════════
   TOKENIZADOR DE CLIP (BPE) · para CLIPSeg (selección por descripción libre, fase 20)
   Mismo algoritmo que el de OpenAI CLIP (MIT) y el `tokenizer.json` del modelo: minúsculas, expresión regular de palabras, bytes →
   caracteres Unicode, fusiones BPE por rango y «</w>» al final de cada palabra. El vocabulario (vocab.json, merges.txt: 49 408 entradas)
   viaja con la web (assets/models/clipseg) y sólo se pide al usarlo. Sin DOM: lo usan también las pruebas en Node.
   ═══════════════════════════════════════════════════════════════ */

const SOT = 49406, EOT = 49407, CTX = 77;

/* Bytes → caracteres imprimibles (el «bytes_to_unicode» de GPT-2/CLIP) */
const byteEncoder = (() => {
  const bs = [], cs = [];
  for(let i = 33; i <= 126; i++) bs.push(i);
  for(let i = 161; i <= 172; i++) bs.push(i);
  for(let i = 174; i <= 255; i++) bs.push(i);
  cs.push(...bs);
  let n = 0;
  for(let b = 0; b < 256; b++) if(!bs.includes(b)){ bs.push(b); cs.push(256 + n++); }
  const m = new Map(); bs.forEach((b, i) => m.set(b, String.fromCodePoint(cs[i])));
  return m;
})();
const utf8 = new TextEncoder();
const WORD = /<\|startoftext\|>|<\|endoftext\|>|'s|'t|'re|'ve|'m|'ll|'d|[\p{L}]+|[\p{N}]|[^\s\p{L}\p{N}]+/gu;

export function createTokenizer(vocab, mergesText){
  const ranks = new Map();
  mergesText.split("\n").slice(1).forEach((l, i) => { if(l) ranks.set(l, i); });
  const cache = new Map();
  function bpe(word){
    if(cache.has(word)) return cache.get(word);
    let parts = [...word];
    parts[parts.length - 1] += "</w>";
    while(parts.length > 1){
      let best = -1, bi = -1;
      for(let i = 0; i < parts.length - 1; i++){
        const r = ranks.get(parts[i] + " " + parts[i + 1]);
        if(r !== undefined && (best < 0 || r < best)){ best = r; bi = i; }
      }
      if(bi < 0) break;
      parts = [...parts.slice(0, bi), parts[bi] + parts[bi + 1], ...parts.slice(bi + 2)];
    }
    cache.set(word, parts);
    return parts;
  }
  /** Texto → ids (con inicio y fin, sin relleno). */
  function encode(text){
    const clean = String(text ?? "").normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();
    const ids = [SOT];
    for(const m of clean.match(WORD) || []){
      if(m === "<|startoftext|>"){ ids.push(SOT); continue; }
      if(m === "<|endoftext|>"){ ids.push(EOT); continue; }
      const word = [...utf8.encode(m)].map(b => byteEncoder.get(b)).join("");
      for(const t of bpe(word)){ const id = vocab[t]; if(id !== undefined) ids.push(id); }
    }
    ids.push(EOT);
    return ids.length > CTX ? [...ids.slice(0, CTX - 1), EOT] : ids;
  }
  /** Ids y máscara de atención de longitud 77 (relleno con el «fin de texto», como el modelo). */
  function pad(text){
    const ids = encode(text), n = ids.length;
    return { ids: Int32Array.from([...ids, ...new Array(CTX - n).fill(EOT)]), mask: Int32Array.from([...new Array(n).fill(1), ...new Array(CTX - n).fill(0)]) };
  }
  return { encode, pad };
}

let loading = null;
/** Carga (una vez) el vocabulario que viaja con la web. */
export function loadClipTokenizer(){
  if(!loading) loading = (async () => {
    const base = new URL("../../assets/models/clipseg/", import.meta.url).href;
    const [v, m] = await Promise.all([fetch(base + "vocab.json").then(r => r.json()), fetch(base + "merges.txt").then(r => r.text())]);
    return createTokenizer(v, m);
  })().catch(e => { loading = null; throw e; });
  return loading;
}
