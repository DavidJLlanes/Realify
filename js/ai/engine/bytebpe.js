/* ═══════════════════════════════════════════════════════════════
   IA · TOKENIZADOR BPE A NIVEL DE BYTES (estilo GPT-2 / BART / Florence-2)
   Lee el `tokenizer.json` de Hugging Face (vocabulario, fusiones y tokens añadidos) y convierte texto en identificadores y de vuelta.
   Entradas: el JSON del tokenizador. Salidas: createByteBPE(json) → { encode(texto, { especiales }), decode(ids), idDe(token) }.
   Límites: sin normalizador (el de Florence-2 no usa ninguno); los tokens añadidos no especiales (<loc_0>…) se reconocen sólo al decodificar; la expresión de palabras sale del propio JSON (GPT-2, Qwen…).
   ═══════════════════════════════════════════════════════════════ */
const PAT_GPT2 = /'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+/gu;

const mapaBytes = (() => {
  const bs = [], cs = [];
  for(let i = 33; i <= 126; i++) bs.push(i);
  for(let i = 161; i <= 172; i++) bs.push(i);
  for(let i = 174; i <= 255; i++) bs.push(i);
  cs.push(...bs);
  let n = 0;
  for(let b = 0; b < 256; b++) if(!bs.includes(b)){ bs.push(b); cs.push(256 + n++); }
  const enc = new Map(), dec = new Map();
  bs.forEach((b, i) => { enc.set(b, String.fromCodePoint(cs[i])); dec.set(String.fromCodePoint(cs[i]), b); });
  return { enc, dec };
})();
const utf8 = new TextEncoder(), utf8d = new TextDecoder();

/** Expresión de separación de palabras del tokenizador (Split › Regex), o la de GPT-2 si no declara ninguna. */
function patronDe(json){
  const pre = json.pre_tokenizer, lista = pre?.type === "Sequence" ? pre.pretokenizers : pre ? [pre] : [];
  const sp = lista.find(p => p.type === "Split" && p.pattern?.Regex);
  /* «(?i:…)» (indicador local de mayúsculas) no lo admiten navegadores algo antiguos: se escribe explícito. */
  return sp ? new RegExp(sp.pattern.Regex.replace("(?i:'s|'t|'re|'ve|'m|'ll|'d)", "'[sS]|'[tT]|'[rR][eE]|'[vV][eE]|'[mM]|'[lL][lL]|'[dD]"), "gu") : PAT_GPT2;
}

export function createByteBPE(json){
  const PAT = patronDe(json), nfc = json.normalizer?.type === "NFC";
  const vocab = json.model.vocab, ranks = new Map(), inverso = new Map(), especiales = new Set();
  json.model.merges.forEach((m, i) => ranks.set(Array.isArray(m) ? m.join(" ") : m, i));
  for(const [t, id] of Object.entries(vocab)) inverso.set(id, t);
  for(const a of json.added_tokens || []){ inverso.set(a.id, a.content); if(a.special) especiales.add(a.id); }
  const cache = new Map();
  function bpe(palabra){
    if(cache.has(palabra)) return cache.get(palabra);
    let p = [...palabra];
    while(p.length > 1){
      let mejor = Infinity, k = -1;
      for(let i = 0; i < p.length - 1; i++){ const r = ranks.get(p[i] + " " + p[i + 1]); if(r !== undefined && r < mejor){ mejor = r; k = i; } }
      if(k < 0) break;
      p = [...p.slice(0, k), p[k] + p[k + 1], ...p.slice(k + 2)];
    }
    cache.set(palabra, p); return p;
  }
  const idDe = t => vocab[t] ?? json.added_tokens?.find(a => a.content === t)?.id;
  /** Texto → ids, con <s> al principio y </s> al final (como el procesador de Florence-2). */
  const marcas = (json.added_tokens || []).filter(a => a.special).map(a => a.content).sort((a, b) => b.length - a.length);
  const reMarcas = marcas.length ? new RegExp("(" + marcas.map(m => m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")") : null;
  /** Texto → ids. `especiales`: añade <s> y </s> (Florence-2, BART). Los tokens especiales escritos en el texto (<|im_start|>…) se reconocen siempre. */
  function encode(texto, { especiales: conEsp = true } = {}){
    const ids = conEsp ? [idDe("<s>")] : [];
    let t0 = String(texto); if(nfc) t0 = t0.normalize("NFC");
    for(const trozo of reMarcas ? t0.split(reMarcas) : [t0]){
      if(!trozo) continue;
      if(marcas.includes(trozo)){ ids.push(idDe(trozo)); continue; }
      for(const m of trozo.match(PAT) || []){
        const w = [...utf8.encode(m)].map(b => mapaBytes.enc.get(b)).join("");
        for(const t of bpe(w)) ids.push(vocab[t] ?? idDe("<unk>"));
      }
    }
    if(conEsp) ids.push(idDe("</s>"));
    return ids;
  }
  /** Ids → texto (se saltan los tokens especiales: <s>, </s>, <pad>…). */
  function decode(ids){
    const bytes = [];
    for(const id of ids){
      if(especiales.has(id)) continue;
      for(const ch of inverso.get(id) || "") bytes.push(mapaBytes.dec.get(ch) ?? 63);
    }
    return utf8d.decode(Uint8Array.from(bytes)).trim();
  }
  return { encode, decode, idDe };
}
