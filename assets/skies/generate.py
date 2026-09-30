import numpy as np, json, sys
from PIL import Image
W, H = 1920, 1080
rng_global = np.random.default_rng(7)

def vnoise(shape_x, shape_y, x, y, seed):
    # ruido de valor suave (interpolación quintica) sobre rejilla aleatoria periódica
    r = np.random.default_rng(seed).random((257, 257))
    xi = np.floor(x).astype(np.int64); yi = np.floor(y).astype(np.int64)
    fx = x - xi; fy = y - yi
    fx = fx * fx * fx * (fx * (fx * 6 - 15) + 10); fy = fy * fy * fy * (fy * (fy * 6 - 15) + 10)
    x0 = xi % 256; y0 = yi % 256; x1 = (x0 + 1); y1 = (y0 + 1)
    a = r[y0, x0]; b = r[y0, x1]; c = r[y1, x0]; d = r[y1, x1]
    return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy

def fbm(x, y, seed, oct=6, lac=2.0, gain=0.5):
    s = np.zeros_like(x); amp = 0.5; f = 1.0; norm = 0
    for o in range(oct):
        s += amp * vnoise(0, 0, x * f, y * f, seed + o * 17); norm += amp
        amp *= gain; f *= lac
    return s / norm

def smooth(e0, e1, v):
    t = np.clip((v - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)

def mix(a, b, t): return a + (b - a) * t[..., None]

def sky(p, seed):
    ys, xs = np.mgrid[0:H, 0:W].astype(np.float64)
    u = (xs - W / 2) / H            # horizontal
    elev = (H - ys) / H             # 0 en el horizonte (abajo) → 1 arriba
    elev = elev * p.get("fov", 0.9) + p.get("hor", 0.02)
    # degradado de cielo: horizonte → cenit (en lineal)
    zen = np.array(p["zenith"], np.float32); hor = np.array(p["horizon"], np.float32)
    t = 1 - np.exp(-elev * p.get("falloff", 3.2))
    col = mix(np.broadcast_to(hor, (H, W, 3)), np.broadcast_to(zen, (H, W, 3)), t)
    # sol y su halo
    sx, sy = p.get("sun", (0.25, 0.08))
    su = (sx - 0.5) * W / H; se = sy * p.get("fov", 0.9) + p.get("hor", 0.02)
    d = np.sqrt((u - su) ** 2 + (elev - se) ** 2)
    glow = np.array(p.get("glow", (1.0, 0.8, 0.5)), np.float32)
    g = p.get("glowAmt", 0.35) * np.exp(-d * p.get("glowFall", 6)) + p.get("haloAmt", 0.0) * np.exp(-d * 1.6)
    col = col + glow * g[..., None]
    if p.get("sunDisk", 0):
        col = col + np.array((1.6, 1.45, 1.2)) * smooth(0.035, 0.022, d)[..., None] * p["sunDisk"]
    # estrellas
    if p.get("stars"):
        r = np.random.default_rng(seed + 3)
        n = int(W * H * p["stars"]); px = r.integers(0, W, n); py = r.integers(0, H, n)
        br = r.random(n) ** 6 * 1.4 + 0.05
        st = np.zeros((H, W), np.float32); np.add.at(st, (py, px), br)
        from PIL import ImageFilter
        sti = Image.fromarray(np.clip(st * 255, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))
        st = np.asarray(sti, np.float32) / 255 * 2.2 + st * 0.6
        col = col + st[..., None] * smooth(0.02, 0.25, elev)[..., None] * np.array((0.9, 0.95, 1.0))
    if p.get("moon"):
        mx, my = p["moon"]; mu = (mx - 0.5) * W / H; me = my * p.get("fov", 0.9)
        dm = np.sqrt((u - mu) ** 2 + (elev - me) ** 2)
        col = col + np.array((0.9, 0.92, 1.0)) * (smooth(0.03, 0.026, dm) * 1.1 + 0.08 * np.exp(-dm * 9))[..., None]
    # nubes en un plano a altura fija: se achican hacia el horizonte
    if p.get("clouds"):
        c = p["clouds"]
        dist = np.minimum(1.0 / np.maximum(elev, 0.012), 40.0)
        cx = u * dist * c.get("scale", 0.9) + (seed % 97) * 1.31
        cy = dist * c.get("scale", 0.9) * c.get("stretch", 1.0) + (seed % 89) * 0.77
        wx = fbm(cx * 0.35, cy * 0.35, seed + 101, 4) - 0.5; wy = fbm(cx * 0.35 + 5, cy * 0.35 + 9, seed + 202, 4) - 0.5
        cx2 = cx + wx * c.get("warp", 1.2); cy2 = cy + wy * c.get("warp", 1.2)
        if c.get("cirrus"):
            n = fbm(cx2 * 0.6, cy2 * 3.2, seed + 7, 6, 2.1, 0.55)
        else:
            n = fbm(cx2, cy2, seed + 7, 7, 2.05, 0.52)
        cov = c.get("cover", 0.5)
        dens = smooth(1 - cov - 0.02, 1 - cov + c.get("soft", 0.18), n)
        # iluminación: muestra desplazada hacia el sol
        dx = (su - u); dy = (se - elev); L = np.sqrt(dx * dx + dy * dy) + 1e-3
        off = 0.35
        n2 = fbm(cx2 + dx / L * off, cy2 - dy / L * off, seed + 7, 7, 2.05, 0.52) if not c.get("cirrus") else fbm((cx2 + dx / L * off) * 0.6, (cy2 - dy / L * off) * 3.2, seed + 7, 6, 2.1, 0.55)
        light = np.clip(0.55 + (n - n2) * c.get("relief", 5.0), 0, 1.25)
        lit = np.array(c.get("lit", (1.0, 0.98, 0.95)), np.float32); shd = np.array(c.get("shade", (0.55, 0.6, 0.7)), np.float32)
        ccol = mix(np.broadcast_to(shd, (H, W, 3)), np.broadcast_to(lit, (H, W, 3)), np.clip(light, 0, 1))
        # borde plateado a contraluz y calor del sol
        ccol = ccol + glow * (g * c.get("sunTint", 0.8))[..., None] * (1 - dens)[..., None] * 1.5
        ccol = ccol + glow * (g * c.get("sunTint", 0.8) * 0.5)[..., None]
        # bruma: hacia el horizonte las nubes se funden con el cielo
        haze = smooth(0.0, 0.18, elev)
        a = dens * c.get("opacity", 0.95) * haze
        col = mix(col, ccol, a)
    # viñeta muy suave y grano
    col = col * (1 - 0.06 * ((u / (W / H / 2)) ** 2))[..., None]
    col = np.clip(col, 0, 1)
    srgb = np.where(col <= 0.0031308, 12.92 * col, 1.055 * np.power(col, 1 / 2.4) - 0.055)
    srgb = srgb + (np.random.default_rng(seed).random((H, W, 1)) - 0.5) / 255 * 1.5
    return Image.fromarray(np.clip(srgb * 255 + 0.5, 0, 255).astype(np.uint8))

def lin(h):  # hex sRGB → lineal
    h = h.lstrip("#"); v = np.array([int(h[i:i+2], 16) / 255 for i in (0, 2, 4)])
    return tuple(np.where(v <= 0.04045, v / 12.92, ((v + 0.055) / 1.055) ** 2.4))

PRESETS = json.load(open(sys.argv[1]))
only = sys.argv[2:] 
for i, (key, name, p) in enumerate(PRESETS):
    if only and key not in only: continue
    q = dict(p)
    for k in ("zenith", "horizon", "glow"):
        if k in q and isinstance(q[k], str): q[k] = lin(q[k])
    if "clouds" in q:
        q["clouds"] = dict(q["clouds"])
        for k in ("lit", "shade"):
            if k in q["clouds"] and isinstance(q["clouds"][k], str): q["clouds"][k] = lin(q["clouds"][k])
    im = sky(q, 11 + i * 31)
    im.save(f"out/{key}.jpg", quality=86, optimize=True, progressive=True)
    t = im.copy(); t.thumbnail((192, 108)); t.save(f"out/{key}-t.jpg", quality=80)
    print(key, "ok")
