# Fusión HDR

Plugin a pantalla completa (escritorio y móvil) que fusiona de 1 a 11 fotos de
la misma escena con distinta exposición.

| Archivo | Qué hace |
|---|---|
| `sources.js` | Origen de las fotos: RAW (revelar la primera y aplicar a todas, una a una, o su JPEG) y fotos abiertas en Realify. |
| `index.js` | Entrada: abre el editor y abre el resultado como una foto nueva (pestaña propia, historial vacío). |
| `ui.js` | Ventana (sobre `js/ui/fsshell.js`): fotos, estilos y ajustes. |
| `worker.js` | Todo el cálculo, fuera del hilo de la interfaz. |
| `engine.js` | Funciones puras: exposición, alineación, fusión y mapeo tonal. |
| `presets.js` | Ajustes por defecto y los 17 estilos. |
| `exif.js` | Lee tiempo, diafragma, ISO y compensación de JPEG/TIFF. |

## Fotos de entrada

- **Del dispositivo**: JPEG, PNG, WebP, HEIC, TIFF y **RAW**. Con RAW se
  pregunta una vez para todo el lote: *revelar la primera y aplicar a todas*
  (recomendado: mismos ajustes y balance de blancos para que las tomas casen;
  el revelador RAW se abre sólo con la primera), *revelar una a una* (el
  revelador con cada foto) o *usar el JPEG de todas* (la previsualización
  incrustada). La exposición de cada RAW sale de sus metadatos.
- **Fotos abiertas**: las pestañas abiertas en Realify, tal como se están
  editando (todas sus capas compuestas). Se eligen con miniaturas.

## Proceso

1. **Horquillado**: EV relativo de cada foto desde el EXIF (JPEG, TIFF/DNG,
   HEIC, PNG y WebP); si falta (fotos reenviadas…), se estima por la razón de
   los valores lineales entre fotos vecinas de brillo y, si los saltos se
   parecen, se igualan (un horquillado suele ir a pasos iguales). Se corrige
   en **Foto elegida**, el primer grupo: la exposición de cada foto en tercios
   de paso (deslizador con − / +, la vista cambia mientras se arrastra) o
   **Pasos entre fotos** para poner todo el horquillado a ⅓…4 EV de golpe.
   Los EV se muestran como los etiqueta la cámara: respecto a la foto del medio
   (−2 / 0 / +2). La lista es el orden de exposición y se reordena
   **arrastrando** (ratón, o mantener pulsado con el dedo; `js/ui/sortable.js`):
   los valores se quedan en su posición y pasan a la foto que la ocupa.
   Cambiar una exposición no reordena la lista.
2. **Alineación** (pensada para horquillados de hasta 11 fotos, ±5 EV): cada
   foto se alinea con su vecina de exposición, en cadena hasta la intermedia.
   Para cada par proponen candidato tres métodos —gradientes del logaritmo de
   la luminancia con la exposición igualada, umbral mediano de Ward y umbral a
   exposición igualada (un nivel de radiancia común a las dos fotos, el único
   que ve algo en las tomas casi quemadas o casi negras)— más «sin
   desplazamiento». Cada candidato se mide a resolución completa con dos
   criterios (gradientes y mapas de umbral), ponderados por los píxeles útiles
   de cada uno, con una preferencia suave por desplazamientos pequeños; se
   afina ±1 px y el acumulado de la cadena se limita al 6 %. Con horquillados
   sintéticos de 3 a 11 fotos: 110 de 116 fotos a ±1 px, error máximo 2 px
   (antes, hasta 43 px en los extremos). Después se pueden recortar los bordes.
3. **Fusión**:
   - *Mapa de radiancia* (Debevec, curva sRGB) con pesos en sombrero y
     **antifantasmas** (suave, medio, fuerte) con foto de referencia elegible.
   - *Fusión de exposición* (Mertens): contraste, saturación y buena
     exposición, mezcladas con pirámides laplacianas.
4. **Mapeo tonal**: *Detalles realzados* (base/detalle con filtro guiado: fuerza,
   saturación, luminosidad, contraste de detalle, suavizado de iluminación,
   microsuavizado, suavizar altas luces), *Compresor de tonos* (Reinhard) y
   *Fotográfico* (Drago).
5. **Ajustes finales**: exposición, contraste, puntos negro y blanco, gamma,
   sombras, altas luces, saturación, intensidad, saturación en luces y en
   sombras, temperatura, tinte y nitidez.

Orden de los grupos, el del trabajo: Foto elegida → Fusión de las fotos →
Estilo → Método → mandos del método → Tono → Color → Detalle. Mientras se
arrastra una exposición, el worker fusiona un borrador más pequeño (55 % de
la vista previa) y sólo se calcula la última posición, sin cola.

Memoria: las fotos se envían al worker de una en una (no se retienen las 11
en la página); en el móvil la copia para alinear es de 1600 px y, antes de
cargar 4 fotos o más, se guarda una copia de las pestañas abiertas: si la
página se cierra por falta de memoria, se recuperan al volver.

Tamaño de trabajo: 4096 px de lado en el ordenador y 2400 px en el móvil.
