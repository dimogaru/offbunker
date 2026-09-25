---
name: Vista pública del viaje demo
description: Separación deliberada entre la sesión invitada mutable y el enlace público de muestra de Tokio.
---

El enlace público del viaje demo debe ofrecer una muestra fija de solo lectura. No debe reflejar ediciones hechas en una sesión invitada concreta ni emitir un token persistente al compartir. La vista pública normal sigue usando los datos de su viaje real.

**Why:** El usuario pidió que pulsar «Compartir» como invitado no escriba en la base de datos y que el enlace funcione para visitantes sin sesión. Publicar la instancia mutable del viaje demo expondría datos específicos de una sesión temporal y exigiría persistencia o acceso anónimo a sus registros.

**How to apply:** Al ampliar la demostración, actualizar su contenido público de muestra de forma deliberada; no conectar la URL pública a los datos privados de una sesión demo ni reutilizar el endpoint de generación de tokens para invitados.