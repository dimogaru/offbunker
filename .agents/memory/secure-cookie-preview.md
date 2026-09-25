---
name: Cookies de sesión en pruebas locales
description: Diferencia entre probar respuestas API por HTTP local y verificar sesiones con cookies seguras a través de la vista previa.
---

Para probar un registro seguido de una petición autenticada en OffBunker, utilizar el dominio HTTPS de desarrollo. Una petición directa a `http://localhost:80/api/auth/register` puede crear la cuenta y devolver 201 sin incluir `Set-Cookie`, mientras que el mismo recorrido por el dominio HTTPS sí recibe la cookie.

**Why:** Una prueba de seis altas consecutivas falló en la verificación de sesión tras la primera alta por ausencia de cookie, no porque el registro hubiera fallado. La prueba por HTTPS confirmó tanto las seis altas como sus sesiones.

**How to apply:** Cuando una verificación HTTP necesite reutilizar la sesión recién creada, enviar las peticiones por el proxy HTTPS de desarrollo; para comprobaciones sin cookie, el proxy local sigue siendo útil. No confundir la falta de `Set-Cookie` bajo HTTP con un fallo del endpoint.