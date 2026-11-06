# ═══════════════════════════════════════════════════════════════
# HERRAMIENTAS DE MODELOS · exportar NAFNet (deblur) a ONNX
# Convierte NAFNet-GoPro-width32.pth (megvii-research/NAFNet, MIT) a ONNX con ancho y alto dinámicos.
# Uso:  python3 tools/models/exportar-nafnet.py NAFNet-GoPro-width32.pth salida.onnx
# Entrada: imagen RGB 0-1 [1, 3, alto, ancho] con alto y ancho MÚLTIPLOS DE 16 (la app rellena el borde de cada tesela).
# Salida: imagen restaurada [1, 3, alto, ancho]. Sin recorte ni relleno internos (en el original van fijos al tamaño de
# ejemplo y rompen el tamaño dinámico). LayerNorm2d se escribe con operaciones normales (el original usa una función propia).
# Límites: sólo la variante GoPro width32 (enc [1,1,1,28], medio 1, dec [1,1,1,1]); necesita torch y onnx.
# ═══════════════════════════════════════════════════════════════
import sys, torch, torch.nn as nn

class LayerNorm2d(nn.Module):
    def __init__(s, c, eps=1e-6):
        super().__init__(); s.weight = nn.Parameter(torch.ones(c)); s.bias = nn.Parameter(torch.zeros(c)); s.eps = eps
    def forward(s, x):
        mu = x.mean(1, keepdim=True); var = (x - mu).pow(2).mean(1, keepdim=True)
        y = (x - mu) / (var + s.eps).sqrt()
        return s.weight.view(1, -1, 1, 1) * y + s.bias.view(1, -1, 1, 1)

class SimpleGate(nn.Module):
    def forward(s, x):
        a, b = x.chunk(2, dim=1); return a * b

class NAFBlock(nn.Module):
    def __init__(s, c):
        super().__init__(); d = c * 2
        s.conv1 = nn.Conv2d(c, d, 1); s.conv2 = nn.Conv2d(d, d, 3, padding=1, groups=d); s.conv3 = nn.Conv2d(d // 2, c, 1)
        s.sca = nn.Sequential(nn.AdaptiveAvgPool2d(1), nn.Conv2d(d // 2, d // 2, 1))
        s.sg = SimpleGate(); f = c * 2
        s.conv4 = nn.Conv2d(c, f, 1); s.conv5 = nn.Conv2d(f // 2, c, 1)
        s.norm1 = LayerNorm2d(c); s.norm2 = LayerNorm2d(c)
        s.beta = nn.Parameter(torch.zeros(1, c, 1, 1)); s.gamma = nn.Parameter(torch.zeros(1, c, 1, 1))
    def forward(s, inp):
        x = s.conv1(s.norm1(inp)); x = s.conv2(x); x = s.sg(x); x = x * s.sca(x); x = s.conv3(x)
        y = inp + x * s.beta
        x = s.conv5(s.sg(s.conv4(s.norm2(y))))
        return y + x * s.gamma

class NAFNet(nn.Module):
    def __init__(s, width=32, mid=1, enc=(1, 1, 1, 28), dec=(1, 1, 1, 1)):
        super().__init__()
        s.intro = nn.Conv2d(3, width, 3, padding=1); s.ending = nn.Conv2d(width, 3, 3, padding=1)
        s.encoders = nn.ModuleList(); s.decoders = nn.ModuleList(); s.ups = nn.ModuleList(); s.downs = nn.ModuleList()
        c = width
        for n in enc:
            s.encoders.append(nn.Sequential(*[NAFBlock(c) for _ in range(n)])); s.downs.append(nn.Conv2d(c, 2 * c, 2, 2)); c *= 2
        s.middle_blks = nn.Sequential(*[NAFBlock(c) for _ in range(mid)])
        for n in dec:
            s.ups.append(nn.Sequential(nn.Conv2d(c, c * 2, 1, bias=False), nn.PixelShuffle(2))); c //= 2
            s.decoders.append(nn.Sequential(*[NAFBlock(c) for _ in range(n)]))
    def forward(s, inp):
        x = s.intro(inp); encs = []
        for e, d in zip(s.encoders, s.downs):
            x = e(x); encs.append(x); x = d(x)
        x = s.middle_blks(x)
        for dec, up, skip in zip(s.decoders, s.ups, encs[::-1]):
            x = dec(up(x) + skip)
        return s.ending(x) + inp

if __name__ == "__main__":
    pesos, salida = sys.argv[1], sys.argv[2]
    ck = torch.load(pesos, map_location="cpu", weights_only=True)
    sd = ck.get("params", ck)
    m = NAFNet(); print(m.load_state_dict(sd, strict=True)); m.eval()
    x = torch.rand(1, 3, 256, 256)
    torch.onnx.export(m, x, salida, input_names=["input"], output_names=["output"], opset_version=17, dynamo=False,
                      dynamic_axes={"input": {2: "alto", 3: "ancho"}, "output": {2: "alto", 3: "ancho"}})
    print("exportado", salida)
