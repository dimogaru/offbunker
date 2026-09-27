---
name: Tipo de cambio al editar gastos
description: Criterio para no modificar saldos históricos de forma inesperada durante la edición.
---

Al editar un gasto sin cambiar su moneda, conserva el tipo de cambio y la fecha originales, aunque cambien el concepto, el importe o el reparto. Si cambia la moneda, convierte usando el tipo disponible para la nueva moneda e informa al usuario.

**Why:** Recalcular un gasto histórico con el tipo actual al corregir un detalle cambia el balance sin que la persona lo espere.

**How to apply:** En cualquier interfaz o API que modifique gastos confirmados y sus conversiones; especialmente si la operación parece una corrección menor.