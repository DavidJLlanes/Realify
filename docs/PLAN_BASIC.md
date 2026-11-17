# Plan: Realify Basic (`/basic/`)

Estado: aprobado por el titular (17 nov 2026); en marcha por fases.

## 1. Qué es
App instalable aparte, «Realify Basic», sólo para fotos, con edición básica y una interfaz limpia y transparente
(foto a pantalla completa y mandos de cristal translúcido encima, como las capturas de referencia).
Vive en `realify.es/basic/`, mismo origen que Realify: comparte iconos, almacenamiento y motor de píxeles.

## 2. Decisiones del titular (17 nov 2026)
- Móvil y escritorio con la misma interfaz; en escritorio, proporciones propias (foto centrada, barra inferior más estrecha).
- **Siempre Premium, sin interruptor** (el bueno y el mejor). Vista previa ligera mientras se arrastra; al soltar y al
  pulsar OK, resultado Premium.
- Tres pestañas: **Ajustar · Estilos · Recortar**. «Estilos» es el comando `filter.looks` de Realify (Filtros → Estilos),
  **sólo los prediseñados** (`LOOKS`), sin «Mis estilos», sin estilo por referencia y sin packs de cámara.
  Se muestran en una fila horizontal con deslizador (miniatura + nombre), **sin clasificación por categorías**.
- Sin corazón, información ni papelera.
- **Contador de versión único** con Realify (`version.json`, `VERSION`, `sw.js`): no hay versión propia.
- Botones para **cambiar de app** (abre la otra con la foto actual) y para **trasladar la imagen** (con la edición aplicada),
  en ambas apps (en Realify: entrada de menú + cajón con icono; en Basic: menú «···»).
- Los 16 ajustes: Exposición, Brillantez, Luces altas, Sombras, Contraste, Brillo, Punto negro, Saturación, Intensidad,
  Temperatura, Tinte, Nitidez, Definición, Reducir ruido, Viñeta, más Auto.
- Recortar: giro 90°, enderezar con regla, voltear, perspectiva vertical y horizontal, proporciones.

## 3. Estructura (capas: `basic/` va por encima de `js/`, como `plugins/`; `js/` nunca importa de `basic/`)
```
basic/
├─ index.html · manifest.webmanifest · sw.js · README.md
├─ css/        tokens.css · shell.css · controls.css
└─ js/
   ├─ main.js                      arranque (≤ 40 líneas)
   ├─ app/     session.js · handoff.js · device.js
   ├─ engine/  pipeline.js · preview.js        (sin DOM; adapta funciones de js/, no copia filtros)
   ├─ ui/      topbar.js · tabbar.js · viewport.js · ruler.js · strip.js
   └─ tabs/    adjust/{index,params,panel}.js · looks/{index,catalog,panel}.js · crop/{index,geometry,panel}.js
```
Normas: archivos ≤ 250 líneas (tope 400), banner `═` en español, ajustes y estilos como **tablas de datos**
(id, nombre, rango, valor por defecto, función del motor), sin código duplicado.

## 4. Traspaso entre apps
Almacén compartido en IndexedDB (mismo origen) + `BroadcastChannel` para avisar a la otra app abierta.
Sin servidor. Un solo formato: imagen en su estado actual (píxeles ya editados) y nombre.

## 5. Fases
- [x] **F0** (v330) Esqueleto instalable y vacío: carpeta, manifiesto, service worker, comprobaciones (`layers.mjs`, `tests/basic/`).
- [x] **F1** (v331) Interfaz: visor a pantalla completa, barras de cristal, pestañas, abrir y guardar, deshacer/rehacer.
- [x] **F2** (v332) Pestaña Ajustar (15 ajustes + Auto) con vista previa ligera y render Premium final. Edición no destructiva: original + receta.
- [x] **F3** (v333) Pestaña Recortar: marco con asas, giro 90°, voltear, enderezar, perspectiva y proporciones; la receta guarda `recorte`.
- [ ] **F4** Pestaña Estilos (fila horizontal, miniaturas, intensidad).
- [ ] **F5** Traspaso: botones en las dos apps.
- [ ] **F6** Escritorio (proporciones), pulido, guía, CHANGELOG, pruebas en móvil y escritorio.

## 6. Por medir antes de F2/F4
- Cuántos estilos hay en `LOOKS` y el coste de generar sus miniaturas sobre la foto del usuario.
- Que el motor Premium de los ajustes admite vista previa ligera sin cambiar el resultado final.

## 7. Notas de F2
- **Receta**: `{ ajustes: { id: valor } }` sobre el original; el historial guarda recetas, no fotos. F3 (recorte) y F4 (estilo) añaden sus claves a la misma receta.
- **Motores reutilizados de Realify** (sin copiarlos): `applyColorMap` (color en luz lineal y OKLab, mapeo de gama, tramado), `applyBCPremium`,
  `applyShadowsHighlightsPremium`, `sharpenRGBA`, `guidedBase`, `denoisePixels` y `measurePremium` (Auto). Nuevo y propio de Basic: la viñeta con tramado.
- **Vista previa**: ≤ 1600 px (1200 en móvil), por etapas con caché; el final se calcula desde el original a resolución completa al guardar
  (en una foto de 12 Mpx tarda del orden de 10 s con todos los ajustes y bloquea la página: mejorar en F6, por trozos o en un worker).
- **Pendiente de medir en móvil real**: tiempos de la vista previa con varios ajustes activos.
