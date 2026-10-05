"""Verificación de tests/psd16-capas.mjs con psd-tools: PSD/PSB de 16 bits con capas. Uso: python3 tests/psd16_check.py [carpeta]"""
import sys, numpy as np
from psd_tools import PSDImage
D = sys.argv[1] if len(sys.argv) > 1 else "/tmp/sc/out"
ok = True
def check(n, c, e=""):
    global ok; print(("OK    " if c else "FALLO ") + n, e); ok = ok and bool(c)
W, H = 120, 80
for ext in ("psd", "psb"):
    psd = PSDImage.open(f"{D}/p16.{ext}")
    check(f"{ext}: 16 bits, {W}×{H}", psd.depth == 16 and psd.width == W and psd.height == H, (psd.depth, psd.width, psd.height))
    layers = {l.name: l for l in psd.descendants()}
    check(f"{ext}: capas y grupo", {"Foto16", "Grupo", "Roja", "Niveles", "Fondo"} <= set(layers), list(layers))
    check(f"{ext}: Roja dentro del grupo con su modo y opacidad", layers["Roja"].parent.name == "Grupo" and layers["Roja"].blend_mode.name == "MULTIPLY" and abs(layers["Roja"].opacity - 204) <= 1, (layers["Roja"].blend_mode, layers["Roja"].opacity))
    check(f"{ext}: máscara de capa real en Roja", layers["Roja"].mask is not None)
    check(f"{ext}: Niveles sigue siendo capa de ajuste", layers["Niveles"].kind in ("adjustment", "levels") or "levels" in str(type(layers["Niveles"])).lower() or "Levels" in str(type(layers["Niveles"])), type(layers["Niveles"]).__name__)
    fx = [type(e).__name__ for e in layers["Roja"].effects] if layers["Roja"].effects else []
    check(f"{ext}: efecto de capa (sombra) conservado", "DropShadow" in fx, fx)
    a = layers["Foto16"].numpy()                      # float 0..1 desde 16 bits
    check(f"{ext}: píxeles de Foto16 a 16 bits exactos (no múltiplos de 257)", a.shape[:2] == (H, W), a.shape)
    y, x = 40, 60; v = 8000 + x * 300 + y * 7
    got = np.round(a[y, x, :3] * 65535).astype(int)
    check(f"{ext}: valor 16 bits del píxel ({x},{y}) = {[v, v >> 1, 65535 - v]}", list(got) == [v, v >> 1, 65535 - v], list(got))
    var = np.unique(np.round(a[40, :, 0] * 65535).astype(int)); check(f"{ext}: la fila tiene {len(var)} valores distintos (con 8 bits habría ≤ 256)", len(var) > 100 and any(int(q) % 257 for q in var))
    comp = psd.numpy()
    check(f"{ext}: compuesto de 16 bits", comp.shape[:2] == (H, W) and np.unique(np.round(comp[40, :, 0] * 65535).astype(int)).size > 100, comp.shape)
print("RESULTADO:", "OK" if ok else "FALLO"); sys.exit(0 if ok else 1)
