# Servicio de panorámicas (OpenCV Stitcher)

Las panorámicas de Realify se unen con un pequeño servicio en Python (FastAPI + OpenCV Stitcher, algoritmo SIFT)
que corre en tu propio servidor. Esta guía te lleva paso a paso, sin necesidad de saber programar.

### Qué necesitas

- Un servidor (VPS) con **Ubuntu o Debian** y acceso por SSH.
- Realify ya publicado con **nginx** y HTTPS.
- Unos 5 minutos.

> Copia cada bloque tal cual y pégalo en la terminal del servidor. Pulsa Enter después de cada uno.
> Donde veas `tu-dominio.com`, escribe el nombre de tu web.

### Paso 1 · Descargar el proyecto

Si ya tienes Realify en el servidor, entra en su carpeta y salta al paso 2. Si no, descárgalo:

```bash
sudo apt update && sudo apt install -y git
sudo git clone https://github.com/DavidJLlanes/Realify.git /var/www/realify
```

### Paso 2 · Instalar el servicio

Entra en la carpeta `panorama` de tu instalación (si seguiste el paso 1 es la de abajo; si no, usa tu ruta) y pega
el bloque completo. Instala lo necesario, prepara Python y deja el servicio arrancado, con inicio automático al
reiniciar el servidor:

```bash
cd /var/www/realify/server/panorama
sudo apt install -y python3 python3-venv libgl1 libglib2.0-0 && \
sudo python3 -m venv venv && \
sudo ./venv/bin/pip install --upgrade pip && \
sudo ./venv/bin/pip install -r requirements.txt && \
sudo cp realify-panorama.service /etc/systemd/system/ && \
sudo sed -i "s|/var/www/realify.es/server/panorama|$PWD|g" /etc/systemd/system/realify-panorama.service && \
sudo systemctl daemon-reload && \
sudo systemctl enable --now realify-panorama && \
sudo systemctl status realify-panorama --no-pager
```

Si todo ha ido bien, verás **`active (running)`** en verde. Pulsa `q` si la pantalla se queda esperando.

La línea con `sed` ajusta automáticamente la ruta del servicio a la carpeta donde estás, así que funciona
estés donde estés.

### Paso 3 · Conectar nginx con el servicio

1. Abre la configuración de tu web (el nombre del archivo puede variar):

   ```bash
   sudo nano /etc/nginx/sites-available/tu-dominio.com
   ```

2. Dentro del bloque `server { ... }` de HTTPS (el que tiene `listen 443`), pega este bloque (también está en
   [`nginx.conf.example`](nginx.conf.example)):

   ```nginx
   location /api/stitch {
       proxy_pass http://127.0.0.1:8767/stitch;
       proxy_http_version 1.1;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
       client_max_body_size 120m;
       proxy_request_buffering off;
       proxy_connect_timeout 60s;
       proxy_send_timeout 300s;
       proxy_read_timeout 300s;
   }
   ```

3. Guarda (`Ctrl+O`, Enter) y sal (`Ctrl+X`).

4. Comprueba que no hay errores y aplica los cambios:

   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   ```

   Debe aparecer `syntax is ok` y `test is successful`.

### Paso 4 · Probarlo

Abre Realify, usa la herramienta de **Panorama** con varias fotos que se solapen y comprueba que las une.

### Si algo falla

| Síntoma | Qué hacer |
| --- | --- |
| El estado no es `active (running)` | Mira el motivo con `sudo journalctl -u realify-panorama -n 50 --no-pager` |
| Error `203/EXEC` o «No such file» | La ruta del servicio no coincide con la carpeta real: repite el paso 2 desde dentro de `panorama` |
| Error `502 Bad Gateway` en la web | El servicio está parado: `sudo systemctl restart realify-panorama` |
| Error `413` al subir fotos | Falta `client_max_body_size 120m;` en nginx |
| Tras actualizar Realify con `git pull` | Reinicia el servicio: `sudo systemctl restart realify-panorama` |

Comandos útiles: `sudo systemctl status realify-panorama` (estado), `sudo systemctl restart realify-panorama` (reiniciar),
`sudo systemctl stop realify-panorama` (parar).
