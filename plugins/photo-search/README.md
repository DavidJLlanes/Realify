# Buscar fotos (`ai.searchPhotos`)
Pantalla completa. Se añaden fotos de la galería, la IA anota cada una (tipo de foto, objetos, colores) y todo queda en un índice local
(IndexedDB `realify-biblioteca`, sólo registros y miniaturas de 160 px, nunca la foto). Se busca con una frase en español.
Motor puro en `js/features/library/search-photos/engine/`. Sin CLIP todavía: ver `docs/PENDIENTE_TITULAR.md`.
