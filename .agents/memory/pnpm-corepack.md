---
name: Pnpm y Corepack en Replit
description: Evitar descargas implícitas de pnpm al fijar packageManager en este entorno.
---

Si se añade o cambia `packageManager`, debe coincidir con la versión de pnpm
preinstalada en el entorno antes de ejecutar validaciones.

**Why:** Corepack intentó descargar una versión distinta en cada comando y los
procesos quedaron bloqueados cuando esa descarga no pudo completarse.

**How to apply:** consultar primero `readlink -f "$(command -v pnpm)"` y fijar
esa versión tanto en `packageManager` como en imágenes que preparen pnpm.