# Forma de la cara (`ai.faceShape`)

Mandíbula, mentón, anchura de la cara, nariz, tamaño de los ojos y grosor de los labios, con cambios pequeños y naturales. Grupo «Forma» del editor de cara
(`plugins/face-editor/`). El motor deforma los planos en luz lineal con `js/features/warp/` (MLS con la malla de 478 puntos como anclas y control de plegados)
y se aplica al final de la cadena. El perfil infantil usa rango reducido (`ranges` de `params.js`). Premium 👑. Prueba: `tests/ia/retrato/forma-motor.mjs`.
