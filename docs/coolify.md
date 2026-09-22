# Despliegue de OffBunker en Coolify

Esta receta despliega el frontend y el API en un único contenedor. El API sirve
la SPA compilada y conserva las subidas en un volumen persistente. PostgreSQL
debe ser un recurso persistente separado de Coolify o una base de datos externa.

## 1. Crear los recursos

1. Cree una base de datos PostgreSQL en Coolify y mantenga activado su volumen
   persistente.
2. Cree una aplicación desde el repositorio de GitHub.
3. Seleccione **Dockerfile** como método de build y use `Dockerfile` como ruta.
4. Configure el puerto interno de la aplicación como `3000`.

El Dockerfile ejecuta `pnpm run build:coolify`, que compila primero TravelHub y
después el API. En cada arranque, el entrypoint ejecuta
`drizzle-kit push` contra `DATABASE_URL`; si el esquema no puede crearse o
actualizarse, el contenedor falla y no informa un healthcheck positivo. Después
arranca el API con:

```sh
pnpm --filter @workspace/api-server run start
```

## 2. Variables de producción

Defina estas variables en la aplicación de Coolify:

| Variable | Valor |
| --- | --- |
| `PORT` | `3000` |
| `SESSION_SECRET` | secreto aleatorio largo; márquelo como secreto |
| `DATABASE_URL` | URL interna de PostgreSQL suministrada por Coolify |
| `UPLOADS_DIR` | `/app/data/uploads` |
| `PUBLIC_DIR` | `/app/artifacts/travel-hub/dist/public` |

No incluya `SESSION_SECRET` ni `DATABASE_URL` en GitHub. Mantenga
`SESSION_SECRET` estable entre despliegues; cambiarlo cierra las sesiones
existentes.

## 3. Volumen de subidas

Añada almacenamiento persistente a la aplicación:

- Tipo: volumen persistente.
- Ruta de destino: `/app/data/uploads`.
- La ruta debe coincidir exactamente con `UPLOADS_DIR`.

Al arrancar, el contenedor prepara el volumen y después ejecuta la aplicación
como el usuario sin privilegios `node`.

No monte un volumen sobre `/app` ni sobre `PUBLIC_DIR`, porque ocultaría los
archivos compilados dentro de la imagen.

Las subidas del repositorio están excluidas de la imagen. Deben importarse al
volumen antes del corte, como se explica a continuación.

## 4. Migrar los datos existentes antes del primer despliegue

No apunte el dominio a Coolify hasta completar esta sección. Necesita
`pg_dump`, `pg_restore`, acceso a la base actual y acceso al volumen nuevo.

En el servidor actual, cree una instantánea de control antes de copiar nada:

```sh
DATABASE_URL="$SOURCE_DATABASE_URL" \
UPLOADS_DIR="$SOURCE_UPLOADS_DIR" \
pnpm run verify:coolify-import -- snapshot offbunker-import-snapshot.json
```

El archivo contiene nombres y cantidades de tablas, además de nombres, tamaños
y hashes de archivos; trátelo como información privada y no lo añada a Git.

Exporte PostgreSQL:

```sh
pg_dump "$SOURCE_DATABASE_URL" \
  --format=custom --no-owner --no-acl \
  --file=offbunker-postgres.dump
```

Restaure el dump en la base vacía de Coolify **antes de iniciar la aplicación**:

```sh
pg_restore --dbname="$COOLIFY_DATABASE_URL" \
  --no-owner --no-acl --exit-on-error \
  offbunker-postgres.dump
```

Copie todo el contenido del directorio actual de subidas al volumen persistente
nuevo. Por ejemplo, si ambos directorios son accesibles desde la misma máquina:

```sh
rsync -a --checksum "$SOURCE_UPLOADS_DIR"/ "$COOLIFY_UPLOADS_DIR"/
```

En Coolify, `COOLIFY_UPLOADS_DIR` debe ser el almacenamiento que se montará como
`/app/data/uploads`. No copie los archivos dentro de la imagen ni sobre
`PUBLIC_DIR`.

Monte el volumen, inicie la aplicación y copie
`offbunker-import-snapshot.json` temporalmente al contenedor. Desde su terminal,
verifique la importación:

```sh
pnpm run verify:coolify-import -- verify /ruta/offbunker-import-snapshot.json
```

La verificación solo termina correctamente si todas las cantidades de filas y
todos los hashes de archivos coinciden con el origen. Después elimine del
servidor nuevo el snapshot y el dump. Conserve una copia cifrada según su
política de respaldo.

Si se trata de una instalación nueva sin datos previos, omita el dump y la
copia de archivos: el entrypoint creará el esquema en la base vacía.

## 5. Healthcheck

El Dockerfile ya incluye un healthcheck HTTP para:

```text
/api/healthz
```

Si Coolify solicita una ruta de healthcheck aparte, use `/api/healthz`. Debe
responder `200` con `{"status":"ok"}`.

## 6. Primera puesta en marcha

1. Despliegue la aplicación.
2. Compruebe el estado saludable en Coolify.
3. Abra `https://SU-DOMINIO/api/healthz`.
4. Inicie sesión y suba un archivo pequeño.

## 7. Verificar persistencia después de un reinicio

La verificación crea un marcador temporal en la tabla de sesiones de PostgreSQL
y en el directorio de subidas. No modifica los datos funcionales de OffBunker.

Desde la terminal del contenedor, antes del reinicio:

```sh
pnpm run verify:coolify-persistence -- prepare
```

Guarde el token que imprime el comando. Reinicie o redespliegue la aplicación
desde Coolify y, en el contenedor nuevo, ejecute:

```sh
pnpm run verify:coolify-persistence -- verify TOKEN
```

El comando termina correctamente solo si encuentra el mismo registro en
PostgreSQL y el mismo archivo en `UPLOADS_DIR`; después elimina ambos marcadores.
Finalmente, compruebe que el archivo subido desde la interfaz sigue accesible.

Si falla la comprobación de archivo, revise que el volumen esté montado
exactamente en `/app/data/uploads`. Si falla PostgreSQL, revise que
`DATABASE_URL` apunte al recurso persistente y no a una base efímera.