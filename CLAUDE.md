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
- Al modificar una herramienta, comprobar sólo esa con `node tests/calidad-herramienta.mjs <comando>` (móvil y escritorio); no publicar con FALLO.

## Móvil y escritorio
- **Todo cambio se hace en las dos versiones, móvil y escritorio**, respetando el
  diseño actual de cada modo (p. ej. lo que va al cajón «Herramientas» del móvil
  va también al menú de escritorio; un ajuste de interfaz se revisa en ambos).
  Probar siempre los dos modos antes de dar algo por terminado.

## Interfaz (móvil)
- **La vista previa de la imagen es prioritaria.** Las interfaces de los plugins
  deben ser siempre **mínimas**: pocas filas, sin miniaturas ni vistas previas
  aparte si el ajuste puede verse en la propia imagen, sin textos de ayuda que
  quiten sitio.
- **Interruptor Premium 👑**: en el móvil va en la **misma barra que el botón de
  aplicar/aceptar, alineado a la izquierda** (junto a ✕ en los editores a
  pantalla completa; a la izquierda de Cancelar/Aplicar en los ajustes), sin
  fila propia. Usar `dockPremium` (`js/ui/premium.js`), `addAction` de
  `fsshell` o `footStart` de `dialog()`/`runAdjust`.
- El interruptor lleva **siempre la palabra «Premium» junto a la corona** y es
  **idéntico en todos los plugins** (mismo componente `premiumSwitch`, mismo
  tamaño y estilo; nunca ocultar `.ps-label`).
- Los desplegables deben aparecer **siempre cerrados** (no dar el foco a un
  `<select>` al abrir: en iOS se despliega).
- El teclado del móvil nunca debe tapar lo que se escribe (`js/ui/keyboard.js`).
- El menú es idéntico en móvil y escritorio. Cada función nueva lleva su entrada
  de menú y su entrada en el cajón «Herramientas» del móvil, con icono.
- Los resultados van a una capa nueva cuando se pueda.

## Modo Premium
Premium = aplicar SIEMPRE los dos modos de procesado de calidad, **el bueno y el
mejor**, ambos superiores al básico (en las funciones de IA también: modelo de
más calidad + refinado de bordes, resolución completa, luz lineal, tramado…).
«Activa el modo premium en X» = mismos mandos con un motor de más calidad (luz
lineal, coma flotante, espacios perceptuales como OKLab, mapeo de gama, tramado,
GPU si hace falta) tras el interruptor con corona; apagado, el plugin queda
exactamente igual que antes.

### Funciones nuevas de IA
- **Todas las funciones de IA nuevas son sólo Premium 👑**, sin versión básica ni
  interruptor: siempre usan el procesado Premium (el bueno y el mejor). En el menú
  y en el cajón llevan «Premium 👑» / la corona.
- **De momento sin pago**: cualquiera puede usarlas.
- Sus modelos sólo se descargan al usarlas (avisando antes del tamaño) y se
  guardan en IndexedDB; licencias que permitan uso comercial (MIT, Apache…).
- **Excepción aceptada por el usuario**: «Retoque de cara» y «Seleccionar por
  texto» (pelo, ojos, labios, orejas, cuello, gafas, sombrero) usan BiSeNet
  (`assets/models/faceparsing/`, entrenado con CelebAMask-HQ, uso NO comercial;
  `noncommercial: true` en js/ai/models.js). El usuario no hace uso comercial. Si algún
  día se cobra Premium, hay que quitarlo o sustituirlo (también del vocabulario del texto).
- Excepción aceptada por el usuario: Zero-DCE++ (CC BY-NC, uso NO comercial) para iluminar fotos oscuras con IA. Si se cobra Premium, quitarlo o sustituirlo.
- Excepción aceptada por el usuario: UltraSharp V2 Lite (CC BY-NC-SA 4.0, uso NO comercial) como modelo de máximo detalle de «Ampliar con IA», sólo en Premium 👑. El usuario no cobra y es responsable de su uso; la licencia real está en el README.

## Límites
- No mejorar Unmark (eliminación de marcas de agua).

