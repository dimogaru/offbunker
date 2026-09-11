---
name: Privacidad de adjuntos móviles
description: Regla de decisión del usuario para almacenamiento local o remoto de documentos en móvil y PWA.
---

En móvil y PWA, la privacidad de un adjunto es una elección explícita mediante la casilla “Personal (Guardar solo en este móvil)”, desmarcada por defecto. Los archivos sin marcar siguen el flujo remoto normal.

**Why:** El producto debe dar control directo al usuario sin bloquear por defecto la sincronización de todos los documentos móviles. Un archivo marcado como personal no puede tocar el servidor ni entrar en procesos de sincronización.

**How to apply:** Capturar la elección al confirmar el formulario, antes de transmitir bytes. Si está marcada, guardar en IndexedDB con `esPersonal: true`; si no, subir al servidor. Excluir siempre los registros personales de cualquier sincronización manual o automática.