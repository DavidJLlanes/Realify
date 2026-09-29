# Realify · normas del proyecto

Editor de imágenes PWA (JavaScript con módulos ES, sin compilación) que se publica
en realify.es con GitHub Actions al subir a `main`.

## Trabajo
- Responder siempre en **español**.
- Desarrollar en la rama de trabajo; subir a `main` sólo cuando el usuario lo pida
  («Sube a main y publica»). No crear PR salvo que se pida.
- En cada versión: subir `VERSION` en `sw.js` y `main.js?v=` en `index.html`, y
  actualizar `CHANGELOG.md`, la guía (`js/ui/guide.js`) y los README afectados.
- Ante la duda, preguntar.

## Interfaz (móvil)
- **La vista previa de la imagen es prioritaria.** Las interfaces de los plugins
  deben ser siempre **mínimas**: pocas filas, sin miniaturas ni vistas previas
  aparte si el ajuste puede verse en la propia imagen, sin textos de ayuda que
  quiten sitio.
- **Interruptor Premium 👑**: en el móvil va en la **misma barra que el botón de
  aplicar/aceptar, alineado a la izquierda** (junto a ✕ en los editores a
  pantalla completa; a la izquierda de Cancelar/Aplicar en los ajustes), sin
  texto y sin fila propia. Usar `dockPremium` (`js/ui/premium.js`), `addAction`
  de `fsshell` o `footStart` de `dialog()`/`runAdjust`.
- Los desplegables deben aparecer **siempre cerrados** (no dar el foco a un
  `<select>` al abrir: en iOS se despliega).
- El teclado del móvil nunca debe tapar lo que se escribe (`js/ui/keyboard.js`).
- El menú es idéntico en móvil y escritorio. Cada función nueva lleva su entrada
  de menú y su entrada en el cajón «Herramientas» del móvil, con icono.
- Los resultados van a una capa nueva cuando se pueda.

## Modo Premium
«Activa el modo premium en X» = mismos mandos con un motor de más calidad (luz
lineal, coma flotante, espacios perceptuales como OKLab, mapeo de gama, tramado,
GPU si hace falta) tras el interruptor con corona; apagado, el plugin queda
exactamente igual que antes.

## Límites
- No mejorar Unmark (eliminación de marcas de agua).
