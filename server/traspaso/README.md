# Relevo de fotos entre las dos apps (`/api/traspaso`)

En el iPhone, **cada app web instalada en la pantalla de inicio tiene su propio almacenamiento**, aunque Realify y
Realify Basic sean las dos de realify.es. Por eso una no puede dejarle la foto a la otra en el propio móvil. Este servicio
hace de buzón de paso para que «Abrir en Realify» / «Abrir en Realify Basic» funcione solo. En escritorio y Android no se
usa: allí las dos apps comparten almacenamiento y la foto pasa por el propio navegador (`js/core/handoff.js`).

```
app A ── cifra la foto (AES-GCM) ── PUT /api/traspaso/buzon/<id> ──▶ nginx ──▶ traspaso.py (127.0.0.1:8767, en memoria)
app B ── al abrirse ──────────────── GET /api/traspaso/buzon/<id> ──▶ la recibe, la descifra y se borra del servidor
```

## Cómo funciona
- **Emparejar, una sola vez**: la primera vez que se pasa una foto, la app que envía genera una clave aleatoria y la deja
  aquí bajo un código de 6 cifras que enseña en pantalla. La otra app, al abrirse, ve que hay un emparejamiento esperando
  desde la misma red y pide el código; al escribirlo recoge la clave y el registro se borra. Desde entonces las dos comparten
  la clave y el paso es automático.
- **Enviar**: la foto se cifra en el móvil con esa clave y se sube al buzón de la otra app (su identificador sale de la clave).
- **Recibir**: la app pide su buzón al abrirse y al volver a primer plano; la foto se borra al entregarla.
- Cliente: `js/core/relevo.js` (sin interfaz); cada app pone su ventanita del código.

## Privacidad y límites
Todo en memoria (nada en disco, sin registros de IP ni de contenido). Las fotos viajan y esperan cifradas; el servidor sólo
ve la clave durante el emparejamiento (hasta que se canjea). Una foto espera como mucho 15 min; un emparejamiento, 30 min.
Topes: 40 MB por foto, 600 MB en total (se borran las más antiguas), 60 envíos/h y 10 emparejamientos/h por IP, 10 códigos
erróneos/h por IP, `limit_req` de nginx.

## Instalación (en el VPS)
```bash
sudo useradd --system --home /opt/traspaso --shell /usr/sbin/nologin traspaso
sudo mkdir -p /opt/traspaso && sudo cp /var/www/realify.es/server/traspaso/traspaso.py /opt/traspaso/
sudo cp /var/www/realify.es/server/traspaso/traspaso.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now traspaso
curl -s http://127.0.0.1:8767/api/traspaso/salud        # {"ok": true}
```
Después, nginx: pegar `server/traspaso/nginx.conf.example` (la zona en `http {}`, el `location` en el `server {}` de
realify.es, antes de `location ^~ /api/`) y `sudo nginx -t && sudo systemctl reload nginx`. Comprobar desde fuera:
`curl -s https://realify.es/api/traspaso/salud`.

Actualizar el script tras un cambio: copiar de nuevo `traspaso.py` a `/opt/traspaso/` y `sudo systemctl restart traspaso`
(se pierden las fotos en espera y los emparejamientos pendientes; los ya hechos siguen valiendo, porque viven en las apps).
