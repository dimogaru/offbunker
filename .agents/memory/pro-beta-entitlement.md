---
name: Cuotas de gastos y rol de quien registra
description: Por qué la exención PRO Beta de gastos sigue al actor y no al propietario del viaje compartido.
---

La cuota de gastos se aplica según el rol del usuario que intenta registrar el gasto, incluso cuando edita un viaje compartido ajeno. Una cuenta PRO Beta puede continuar después del límite; una cuenta gratuita sigue necesitando solicitar acceso.

**Why:** El flujo prometido es un regalo inmediato al usuario que alcanza el límite y debe completar *su* gasto sin interrupción. Basarlo exclusivamente en el propietario impediría ese resultado para colaboradores y haría engañoso el botón de solicitud en su cuenta.

**How to apply:** Mantener coherentes el control del servidor, el contador en la interfaz y la oferta con el rol de quien escribe. Si el producto cambia a una cuota por propietario, rediseñar conjuntamente la invitación, la oferta y el desbloqueo de colaboradores antes de alterar solo el backend.