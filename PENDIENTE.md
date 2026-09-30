# Pendiente

Ideas acordadas para más adelante (no hechas todavía).

## Informe de errores en Ayuda (con Postfix del VPS)

- Entrada «Informar de un error» en el menú Ayuda (móvil y escritorio): qué ha pasado,
  correo opcional para responder y casilla «Adjuntar diagnóstico» (`__realifyDiag`). Sin la
  foto salvo que se pida expresamente.
- En el VPS: ruta `/api/informe` en nginx → script corto (PHP-FPM, Python o Node, según lo
  que haya) → `sendmail` de Postfix.
- Seguridad: destinatario fijo en el servidor, `limit_req` por IP, tamaño máximo, campo
  trampa contra bots, sin saltos de línea en asunto/cabeceras, correo del usuario sólo en
  `Reply-To` y validado. SPF y DKIM en realify.es para no caer en spam.
- Opcional: si la app no arranca o salta un error grave, ofrecer «¿Enviar informe?» con el
  diagnóstico relleno (siempre preguntando).

### Mejora del diagnóstico: qué archivo no se pudo cargar

Cuando Firefox (u otro navegador) no arranca con «No se pudo cargar: js/main.js?v=…», el
diagnóstico no dice cuál de los módulos falló. La autorreparación de `js/boot-guard.js` ya pide
todos los módulos uno a uno (`refreshModules`): anotar los que no devuelven 200 (URL + código
HTTP, o «bloqueado / error de red» si el `fetch` falla) y añadirlos a `__realifyDiag`. Así el
informe diría directamente, por ejemplo, «falla /js/xxx.js con 503» o «bloqueado».
