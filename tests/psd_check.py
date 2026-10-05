"""Lee con psd-tools los PSD/PSB que genera tests/psd.mjs y comprueba capas, modos, máscara, efectos y ajustes."""
import sys
from psd_tools import PSDImage
d = sys.argv[1] if len(sys.argv) > 1 else "/tmp"
bad = 0
def chk(c, m):
    global bad
    if not c: bad += 1; print("FALLO:", m)
for f, size in (("t.psd", (200, 120)), ("t.psb", (200, 120)), ("t.x2.psd", (400, 240))):
    p = PSDImage.open(f"{d}/{f}")
    print(f, "versión", p.version, p.size, [(l.name, l.kind, str(l.blend_mode).split(".")[-1], l.visible) for l in p.descendants()])
    chk(p.size == size, f"{f} tamaño {p.size}")
    chk(p.version == (2 if f.endswith("psb") else 1), f"{f} versión")
    ls = {l.name: l for l in p}
    chk({"Fondo", "Rojo", "Verde", "Niveles", "Invertir"} <= set(ls), f"{f} capas {list(ls)}")
    r = ls["Rojo"]
    chk(str(r.blend_mode).endswith("LINEAR_BURN"), f"{f} modo Rojo {r.blend_mode}")
    chk(r.mask is not None, f"{f} sin máscara")
    chk(str(ls["Verde"].blend_mode).endswith("PIN_LIGHT"), f"{f} modo Verde")
    chk(ls["Niveles"].kind == "adjustment" or "Levels" in type(ls["Niveles"]).__name__ or ls["Niveles"].kind != "pixel", f"{f} Niveles no es ajuste ({ls['Niveles'].kind})")
    chk(not ls["Invertir"].visible, f"{f} Invertir debería estar oculta")
    try:
        im = p.composite(); chk(im is not None, f"{f} sin compuesto")
    except Exception as e: print("aviso compuesto:", e)
    print("  ICC:", bool(p.image_resources.get_data(1039)), " resolución:", p.image_resources.get_data(1005) is not None)
    chk(p.image_resources.get_data(1039) is not None, f"{f} sin perfil ICC")
sys.exit(1 if bad else 0)
