# Unmark · servidor de apoyo

Servidor pequeño (FastAPI) para las dos etapas del filtro **Unmark** de
Realify que no caben en un navegador:

| Ruta | Qué hace | Motor |
|---|---|---|
| `POST /inpaint` | Rellena la máscara blanca (marca visible) | `remove-ai-watermarks` (LaMa/MI-GAN) → `simple-lama-inpainting` → OpenCV Telea |
| `POST /regenerate` | Re-sintetiza la imagen por difusión (marcas invisibles tipo SynthID) | `remove-ai-watermarks[qwen-zimage]` → SDXL img2img (`diffusers`) |
| `GET /health` | Estado, GPU, motores disponibles | — |

Todo lo demás de Realify sigue siendo local. La app sólo llama aquí
cuando el usuario ha escrito la dirección del servidor en el panel y
tiene encendida una etapa «servidor».

## Instalación en el VPS (Ubuntu/Debian)

```bash
sudo useradd -r -m -d /opt/unmark unmark
sudo -u unmark -H bash -c '
  cd /opt/unmark
  python3 -m venv venv && . venv/bin/activate
  pip install -U pip
  pip install -r requirements.txt
  # Regeneración (elige una vía):
  #  a) proyecto de referencia, necesita GPU NVIDIA con CUDA:
  #     pip install "remove-ai-watermarks[visible,qwen-zimage]"
  #  b) sólo diffusers (SDXL img2img, ~7 GB de pesos la primera vez):
  #     pip install torch --index-url https://download.pytorch.org/whl/cu124
  #     pip install diffusers transformers accelerate safetensors
'
sudo cp app.py requirements.txt /opt/unmark/
sudo cp unmark.service /etc/systemd/system/unmark.service
sudo nano /etc/systemd/system/unmark.service   # UNMARK_TOKEN y UNMARK_ORIGINS
sudo systemctl daemon-reload && sudo systemctl enable --now unmark
curl -H "Authorization: Bearer TU-TOKEN" http://127.0.0.1:8765/health
```

Sin GPU, `/inpaint` funciona igual (LaMa en CPU tarda unos segundos por
imagen) y `/regenerate` sólo con `sdxl-img2img`, muy lento en CPU: cuenta
minutos por imagen.

## Nginx + TLS

El navegador exige HTTPS para hablar con otro origen. Usa un subdominio
(`unmark.tudominio.es`) con certificado (`certbot --nginx`) y el
`nginx.conf.example` de esta carpeta: fija `client_max_body_size` y
`proxy_read_timeout` altos porque una regeneración tarda.

## Abrir la CSP de Realify

La política de seguridad de la app (`.htaccess`, cabecera
`Content-Security-Policy`) bloquea cualquier conexión que no sea al propio
sitio. Añade el origen del servidor a `connect-src`:

```
connect-src 'self' www.googletagmanager.com https://unmark.tudominio.es;
```

Y `UNMARK_ORIGINS` en el servicio debe incluir el origen de la app
(`https://realify.es`) para que el CORS lo permita.

## En la app

Filtro → Unmark → «Semilla y servidor»: dirección y token, «Probar
conexión». A partir de ahí:

- «Relleno de la zona» → método **Servidor** usa `/inpaint` al aplicar.
- «Regeneración por difusión (servidor)» usa `/regenerate` al aplicar; el
  botón «Probar en el servidor» la ejecuta sobre la vista previa reducida
  para verla antes.

## Parámetros

- `strength` 0..1: cuánto se aleja la regeneración del original (0,25–0,45
  suele bastar para SynthID conservando la escena).
- `pipeline`: `auto`, `qwen-zimage`, `sdxl-zimage`, `chroma-zimage` (del
  proyecto de referencia) o `sdxl-img2img` (fallback).
- `humanize`: `1`/`0`, acabado natural del proyecto de referencia si está.
- `UNMARK_MAX_MP`: la difusión trabaja como mucho a esos megapíxeles y el
  resultado se devuelve al tamaño original.

## Uso legítimo

Igual que el proyecto de referencia: para contenido propio, investigación
sobre detectores y prueba de defensas. No para retirar marcas de terceros.
