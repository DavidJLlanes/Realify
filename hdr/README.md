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
- **Máximo 11 fotos**: si se eligen más (del dispositivo o de las abiertas), un
  diálogo con contador deja escoger cuáles antes de abrir ninguna. Las fotos con
  otra proporción u orientación se descartan una a una, con aviso.
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
   sombras, temperatura, tinte y nitidez. El cuentagotas de punto blanco
   (Color) pide al worker `wbSample`: la media de un entorno de la imagen
   mapeada ANTES del acabado, resuelta con `wbNeutral` (engine.js) o
   `wbNeutralPremium` (premium.js), las inversas exactas de cada acabado.

Orden de los grupos, el del trabajo: Foto elegida → Fusión de las fotos →
Estilo → Método → mandos del método → Tono → Color → Detalle. Mientras se
arrastra una exposición, el worker fusiona un borrador más pequeño (55 % de
la vista previa) y sólo se calcula la última posición, sin cola.

Memoria: las fotos se envían al worker de una en una (no se retienen las 11
en la página); en el móvil la copia para alinear es de 1600 px y, antes de
cargar 4 fotos o más, se guarda una copia de las pestañas abiertas: si la
página se cierra por falta de memoria, se recuperan al volver.

Tamaño de trabajo: 4096 px de lado en el ordenador y 2400 px en el móvil.

## Modo Premium (`premium.js`)

Interruptor con corona en la barra superior (`js/ui/premium.js`, se recuerda en
el navegador). Mismos mandos, estilos y métodos; apagado, el HDR es exactamente el
de siempre (comprobado: salida idéntica byte a byte con los estilos de prueba).
Encendido, todo en coma flotante, luz lineal y Rec.2020:

1. **Radiancia exacta**. RAW con Premium activo al añadirlos: el revelador entrega
   además la escena en luz lineal (balance, óptica, ruido y exposición del revelador;
   sin tono), con el nivel de recorte del sensor por canal. JPEG/HEIC/PNG: **curva de
   respuesta** estimada del horquillado (Robertson, Borman y Stevenson, 1999, con todos
   los píxeles) y una versión polinómica suave (Mitsunaga y Nayar); se queda la que
   mejor hace casar las fotos, o la sRGB si ninguna la mejora o la escena tiene pocos
   niveles (casi plana).
2. **Fusión de máxima verosimilitud**: peso t² / varianza (lectura y fotones en RAW;
   en 8 bits, la pendiente de la curva por nivel más el ruido); lo quemado pesa 0 y,
   si todo está quemado, se toma la foto más oscura.
3. **Alineación con fracción de píxel**: Lucas–Kanade (Gauss–Newton con pesos de
   Huber) sobre el logaritmo de la luminancia a exposición igualada, desde el
   desplazamiento entero de siempre; muestreo bilineal.
4. **Antifantasmas por zonas**: diferencia canal a canal (ve un objeto de otro color
   con la misma luminancia) a baja resolución, suavizada y ensanchada, como máscara
   de pesos.
5. **Tono y color**: los métodos de radiancia conservan las proporciones RGB
   (`engine.js › emit`); el acabado (`finishPremium`) trabaja en OKLab, ajusta la gama
   a sRGB reduciendo sólo el croma y trama al pasar a 8 bits.
6. **Exportar**: TIFF de 16 bits y la radiancia en `.hdr` (RGBE, primarios sRGB).

`tests/premium.mjs` (Node, sin navegador) mide frente a la radiancia real de un
horquillado sintético de 5 fotos con una cámara de curva en S, ruido y desplazamientos
de fracción de píxel: sombras profundas con error rms 0,98 → 0,19 EV y sesgo 0,63 →
0,02 EV; sol 0,32 → 0,20 EV; suelo igual; cielo liso hasta un 10 % peor (las tomas
largas pesan más y arrastran más error de alineación). Alineación 1,82 → 1,61 px de
error total. Antifantasmas: 0 % de fantasma con un objeto de la misma luminancia que
el fondo (el de siempre deja el 50 %).

Límites honestos: la vista previa del HDR sigue calculándose en el worker (CPU), no
en la GPU; no hay perfiles de objetivo ni reducción de ruido con IA; para fusionar los
datos lineales de RAW hay que activar Premium antes de añadirlos.
