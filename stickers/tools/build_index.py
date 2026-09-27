"""
Stickers · generador de la biblioteca local de Fluent Emoji.

Uso:
    python build_index.py <fluentui-emoji-main.zip> <cldr es annotations.json> <cldr es derived.json>

Copia los emojis del repositorio microsoft/fluentui-emoji (licencia MIT) a
stickers/emoji/<id>/ con nombres cortos y sin espacios:

    3d.png  color.svg  flat.svg  hc.svg          (tono por defecto)
    3d-light.png  color-dark.svg  …              (tonos de piel)

y escribe stickers/emoji/index.json con el nombre y las palabras clave en
español (anotaciones CLDR de Unicode) e inglés, el grupo y qué estilos y
tonos existen de cada uno.
"""
import json, re, sys, zipfile, os, shutil, unicodedata

ZIP, ES, ES_DERIVED = sys.argv[1:4]
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "emoji"))

STYLES = {"3D": ("3d", "png"), "Color": ("color", "svg"), "Flat": ("flat", "svg"), "High Contrast": ("hc", "svg")}
TONES = {"Default": "", "Light": "light", "Medium-Light": "medium-light", "Medium": "medium",
         "Medium-Dark": "medium-dark", "Dark": "dark"}
GROUPS = ["Smileys & Emotion", "People & Body", "Animals & Nature", "Food & Drink", "Travel & Places",
          "Activities", "Objects", "Symbols", "Flags", "Component"]

def slug(name):
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")

es = json.load(open(ES, encoding="utf-8"))["annotations"]["annotations"]
es.update(json.load(open(ES_DERIVED, encoding="utf-8"))["annotationsDerived"]["annotations"])
def es_ann(glyph):
    for g in (glyph, glyph.replace("️", ""), glyph + "️"):
        if g in es: return es[g]
    return {}

if os.path.isdir(OUT): shutil.rmtree(OUT)
os.makedirs(OUT)

z = zipfile.ZipFile(ZIP)
names = z.namelist()
root = names[0].split("/")[0] + "/assets/"
folders = sorted({n[len(root):].split("/")[0] for n in names if n.startswith(root) and n[len(root):].count("/") >= 1})

index, used = [], set()
for folder in folders:
    base = root + folder + "/"
    try: meta = json.loads(z.read(base + "metadata.json").decode("utf-8-sig"))
    except KeyError: continue
    ident = slug(folder)
    while ident in used: ident += "-x"
    used.add(ident)
    dest = os.path.join(OUT, ident); os.makedirs(dest)
    styles, tones = set(), set()
    for n in names:
        if not n.startswith(base) or n.endswith("/"): continue
        parts = n[len(base):].split("/")
        if len(parts) == 2 and parts[0] in STYLES: tone, style = "Default", parts[0]
        elif len(parts) == 3 and parts[0] in TONES and parts[1] in STYLES: tone, style = parts[0], parts[1]
        else: continue
        key, ext = STYLES[style]
        t = TONES[tone]
        fname = f"{key}-{t}.{ext}" if t else f"{key}.{ext}"
        with open(os.path.join(dest, fname), "wb") as f: f.write(z.read(n))
        if t: tones.add(t)
        else: styles.add(key)
    ann = es_ann(meta.get("glyph", ""))
    name_es = (ann.get("tts") or [""])[0]
    kw = sorted({*ann.get("default", []), *meta.get("keywords", [])} - {name_es})
    index.append({
        "id": ident, "es": name_es, "en": meta.get("cldr") or meta.get("tts") or folder,
        "g": GROUPS.index(meta["group"]) if meta.get("group") in GROUPS else len(GROUPS) - 1,
        "k": " ".join(kw), "c": meta.get("glyph", ""),
        "s": "".join(k for k in ["3d", "color", "flat", "hc"] if k in styles),
        "t": 1 if tones else 0
    })

index.sort(key=lambda e: (e["g"], e["en"]))
with open(os.path.join(OUT, "index.json"), "w", encoding="utf-8") as f:
    json.dump({"groups": GROUPS, "emoji": index}, f, ensure_ascii=False, separators=(",", ":"))
print(len(index), "emojis; sin nombre en español:", sum(1 for e in index if not e["es"]))
