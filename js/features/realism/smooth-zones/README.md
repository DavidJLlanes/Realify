# Zonas demasiado lisas con IA (`ai.smoothZones`)

Mide la energía de detalle fino de la luminancia (relativa a la señal, como el ruido de disparo); donde queda por debajo de lo que daría un sensor real, la zona es «demasiado lisa» y se le añade grano de banda limitada solo ahí. Con «Sólo mostrar las zonas lisas» las marca en rojo.

Interfaz simple, Premium 👑 sin interruptor, sin modelos (algoritmo propio en luz lineal). Motor: `js/features/realism/engine/zonas.js` y `grano.js`; el ruido es el común de `portrait/shared/ruido.js`. El grano se genera a la escala de trabajo y se amplía a la foto. Pruebas: `tests/ia/realismo/`.
