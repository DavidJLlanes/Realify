# IA avanzada de Realify

Proyecto aislado para la IA local CUDA/PyTorch y, más adelante, el fallback cloud.

La hoja de ruta obligatoria está en [ROADMAP.md](./ROADMAP.md).

## Estado

Fase actual: **4 — Prompt → ajustes ✅**.

Implementado:

- Real-ESRGAN ×2/×4;
- NAFNet Denoise/Deblur;
- Qwen3-1.7B para interpretar prompts;
- controles manuales activos;
- prompt → JSON estructurado → sliders → previsualización;
- exposición, brillo, contraste, luces, sombras, blancos, negros, balance de color, saturación, vibrancia, claridad, textura, dehaze y enfoque;
- validación estricta y rangos cerrados;
- peticiones no soportadas separadas del ajuste fotográfico;
- aplicación no destructiva como capa;
- soporte de prompt también en móvil;
- gestión de VRAM entre motores;
- todos los pesos y temporales permanecen dentro de `advanced-ai/`.

Próxima fase: **5 — Segmentación y máscaras**.
