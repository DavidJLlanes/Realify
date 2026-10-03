# Realify AI Local

Servicio local del proyecto IA avanzada. En Fase 1 sólo detecta PyTorch, CUDA, GPU y VRAM.

## Desarrollo

Crear un entorno Python, instalar las dependencias web:

```bash
pip install -r requirements.txt
```

Instalar después una versión de PyTorch compatible con la GPU/CUDA siguiendo el selector oficial de PyTorch.

Arrancar:

```bash
python server.py
```

La API escucha únicamente en:

```text
http://127.0.0.1:17834
```

Comprobación:

```text
GET /status
```

No se ha implementado todavía ningún endpoint de inferencia.
