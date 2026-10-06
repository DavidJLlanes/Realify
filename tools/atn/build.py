#!/usr/bin/env python3
"""Convierte acciones de Photoshop (.atn) en recetas de estilos de Realify (assets/estilos/*.json).

Uso:  python3 tools/atn/build.py <carpeta con los .atn> [carpeta de salida (por defecto assets/estilos)]

Lee cada .atn (formato binario de Adobe: atnparse.py), simula la pila de capas que construye cada acción (compiler.py) y guarda las que se saben
interpretar por completo. Las demás se anotan en `skipped` con el motivo, para saber qué falta. El motor que evalúa las recetas es
js/filters/styleengine.js. El orden de los estilos dentro de cada archivo NO debe cambiar nunca (las capas guardadas los referencian por posición
además de por id): lo nuevo, siempre al final o en un archivo nuevo."""
import sys, os, re, json, glob, hashlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from atnparse import parse
import compiler as C

SRC = sys.argv[1] if len(sys.argv) > 1 else "."
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "assets", "estilos")
os.makedirs(OUT, exist_ok=True)

def slug(s): return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
def clean(s): return re.sub(r"\s+", " ", re.sub(r"[-_]+", " ", s)).strip(" -")

# (patrón del nombre de la acción → categoría, plantilla del nombre)
RULES_MATTE = [
    (r"^Vignette ([IVX]+)$", "Viñetas", lambda m: f"Viñeta {m.group(1)}"),
    (r"^(.*) Haze Brush$", "Bruma", lambda m: f"Bruma {clean(m.group(1))}"),
    (r"^.*$", "Matte", lambda m: clean(m.group(0)).replace(" matte", " Matte").replace("matte", "Matte") if "atte" in m.group(0) else clean(m.group(0))),
]
RULES_VINTAGE = [
    (r"^VR[ _]?(\d+)$", "Retro VR", lambda m: f"VR {int(m.group(1)):02d}"),
    (r"^Light Leaks - SS\.(\d+)$", "Destellos de luz", lambda m: f"Destello {int(m.group(1)):02d}"),
    (r"^Bokeh - SS\.(\d+)$", "Bokeh", lambda m: f"Bokeh {int(m.group(1)):02d}"),
    (r"^Dirty Textures$", "Texturas", lambda m: "Texturas sucias"),
    (r"^Vignette$", "Viñetas", lambda m: "Viñeta retro"),
    (r"^Frame : (.*)$", "Marcos", lambda m: "Marco " + {"Polaroid": "Polaroid", "Rectangle 20px": "rectangular fino", "Rectangle 40px": "rectangular grueso", "Rounded 20px": "redondeado fino", "Rounded 40px": "redondeado grueso"}.get(m.group(1), m.group(1))),
    (r"^Glitch FX$", "Glitch", lambda m: "Glitch"),
    (r"^Glitch FX - B/W$", "Glitch", lambda m: "Glitch B/N"),
    (r"^Glitch FX - Bad Signal$", "Glitch", lambda m: "Glitch señal mala"),
    (r"^Sharpen$", "Nitidez", lambda m: "Nitidez retro"),
]
RULES_NONE = []   # Painting FX: cadenas de filtros de píxeles (Diffuse, High Pass, Reduce Noise, Emboss, Ripple, Smart Sharpen) que el motor por píxel no reproduce
PACKS = [
    # id, patrón del archivo, etiqueta, reglas, ref (lado mayor de la imagen para la que se grabaron las medidas en píxeles)
    ("matte", r"Matte", "Matte", RULES_MATTE, 3000),
    ("vintage", r"Vintage_Retro|Vintage-Retro|Vintage Retro", "Retro y destellos", RULES_VINTAGE, 3000),
]

def categorize(rules, name):
    for pat, cat, fn in rules:
        m = re.match(pat, name.strip())
        if m: return cat, fn(m)
    return None, None

files = sorted(glob.glob(os.path.join(SRC, "*.atn")))
seen_hash = set(); index = []
for pid, fpat, label, rules, ref in PACKS:
    styles, skipped, names = [], [], set()
    for f in files:
        if not re.search(fpat, os.path.basename(f)): continue
        h = hashlib.md5(open(f, "rb").read()).hexdigest()
        j = parse(f)
        acts = j["actions"]; byname = {a["name"]: a for a in acts}
        for a in acts:
            if not a["steps"]: continue
            cat, nm = categorize(rules, a["name"])
            if cat is None: skipped.append({"action": a["name"].strip(), "reason": "fuera de las categorías convertidas"}); continue
            if nm in names: continue            # el mismo conjunto subido dos veces
            r, un = C.compile_action(a, byname)
            if un: skipped.append({"action": a["name"].strip(), "reason": "; ".join(un)}); continue
            names.add(nm); r["ref"] = ref
            styles.append({"id": f"{pid}:{slug(a['name'])}", "name": nm, "cat": cat, "recipe": r})
    path = os.path.join(OUT, f"atn-{pid}.json")
    json.dump({"pack": pid, "label": label, "styles": styles}, open(path, "w"), separators=(",", ":"), ensure_ascii=False)
    json.dump(skipped, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), f"omitidos-{pid}.json"), "w"), indent=1, ensure_ascii=False)
    index.append({"file": f"atn-{pid}.json", "pack": pid, "label": label, "count": len(styles)})
    print(f"{pid}: {len(styles)} estilos, {len(skipped)} omitidos · {os.path.getsize(path)//1024} KB")
json.dump({"packs": index}, open(os.path.join(OUT, "index.json"), "w"), indent=1)
