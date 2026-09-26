---
name: Push de Drizzle en desarrollo
description: La detección de renombres al añadir tablas en la base de desarrollo puede bloquear el push no interactivo.
---

Al añadir tablas nuevas, Drizzle puede proponer renombrar una tabla existente en vez de crearlas. En una ejecución no interactiva el comando puede terminar sin aplicar nada, incluso sin indicar un fallo del proceso. No usar `--force` a ciegas cuando hay datos existentes.

**Why:** Se observó una sugerencia de renombrar la tabla de sesiones al agregar una tabla no relacionada. Aceptarla o forzar todo el diff habría arriesgado datos ajenos a la nueva función.

**How to apply:** Comprobar qué columnas/tablas existen realmente tras el comando; si aparece la ambigüedad, aplicar solo cambios aditivos y explícitos a la base de desarrollo, acordes con el esquema fuente, y comprobarlos. No tocar producción por esta vía.