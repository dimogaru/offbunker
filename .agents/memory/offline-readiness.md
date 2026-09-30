---
name: Comprobación de archivos offline
description: Criterio conservador para declarar disponibles los documentos de un viaje sin conexión.
---

La verificación de preparación offline debe comprobar que el archivo realmente tiene bytes accesibles en el dispositivo (Blob local o respuesta de la caché), no basarse en el nombre del documento, su URL ni en un indicador anterior de sincronización. Si falta la lista local persistida, no afirmar que se han comprobado *todos* los archivos. Etiquetas como «pasaporte» o «reserva» solo identifican archivos candidatos; no validan identidad, contenido ni vigencia.

**Why:** El navegador puede borrar la caché aunque queden metadatos y marcas de sincronización. Una confirmación equivocada antes de volar podría dejar al viajero sin sus archivos.

**How to apply:** Al modificar el checklist, conservar estados «pendiente/no verificado» para lecturas fallidas o información incompleta. No afirmar que un pasaporte o una reserva es válido porque existe una copia local.