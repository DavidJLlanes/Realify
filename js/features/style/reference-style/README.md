# Estilo desde una foto de referencia (`ai.styleFromReference`)

Lleva el color y el tono de la foto hacia los de una referencia: estadísticas en OKLab por zonas (cielo, personas, resto, con la segmentación de la IA; sin modelos se usa una sola zona), cuantiles para el tono y media/desviación para el color. «Sugerir ajustes» no toca la foto: propone exposición, contraste, calidez, tinte y saturación. Premium 👑. No cambia «Igualar color…». Motor puro: `style/engine/transferir.js`. Pruebas: `tests/ia/estilo/`.
