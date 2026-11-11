# Piloto Android y HTTPS

Usa una instancia de pruebas con datos ficticios, un nombre DNS accesible desde el teléfono y un certificado válido para ese nombre. El dispositivo debe confiar en la autoridad emisora.

## Preparar la API

1. Prepara PostgreSQL y configura `DATABASE_URL` y `DEV_API_TOKEN` en el entorno privado del servidor.
2. Genera Prisma con `pnpm db:generate` y aplica las migraciones con `pnpm exec prisma migrate deploy --config packages/database/prisma.config.ts`.
3. Elige un puerto accesible desde Android. Para HTTPS directo, apunta los archivos PEM a la cadena completa y a la clave privada, con acceso restringido al usuario del servicio. Ejemplo de configuración en el `.env` del servidor:

   ```dotenv
   NODE_ENV=production
   HOST=0.0.0.0
   PORT=3443
   TRUST_PROXY_LOOPBACK=0
   TLS_CERT_FILE=/ruta/al/fullchain.pem
   TLS_KEY_FILE=/ruta/a/la/privkey.pem
   ```

4. Inicia la API desde la raíz con `node --import tsx --env-file=.env apps/api/src/index.ts`. Abre solo el puerto TLS necesario y comprueba `/health` por HTTPS con validación de certificado. Reinicia la API tras renovar el certificado para que vuelva a leer los archivos.
5. Si ya tienes un proxy TLS local, deja los dos archivos PEM sin configurar, liga la API a `127.0.0.1` o `::1` y establece `TRUST_PROXY_LOOPBACK=1`. El proxy debe sobrescribir los encabezados reenviados.

## Compilar e instalar el APK

Instala primero las dependencias desde la raíz con `pnpm install --frozen-lockfile`. Puedes generar un APK para explorar la demo o uno conectado a la API. Para el segundo, define `EXPO_PUBLIC_API_URL` con la URL HTTPS de pruebas en el entorno **preview** del proyecto EAS. La URL se incorpora al compilar. Cambiarla requiere otro build.

Si vas a compilar un fork con tu cuenta Expo, vincula esa copia a un proyecto de EAS que controles. Si `apps/mobile/app.json` conserva `extra.eas.projectId` del proyecto original, elimina solo esa propiedad de tu copia antes de vincularla.

En PowerShell, desde la raíz:

```powershell
Set-Location apps/mobile
pnpm dlx eas-cli@latest login
# Solo para la primera vinculación o configuración del proyecto.
pnpm dlx eas-cli@latest build:configure
pnpm dlx eas-cli@latest build --platform android --profile preview
```

Si EAS solicita credenciales de firma, usa las del proyecto Android existente o deja que EAS genere la primera clave. Conserva la misma clave para actualizar el APK sobre una instalación previa. El perfil `preview` de `eas.json` genera un APK. El perfil `production` genera un AAB para distribución.

Antes de compilar, comprueba que `build.preview.pnpm` en `eas.json` coincida con `packageManager` del `package.json` raíz. Si tu clon usa pnpm 12.18.0, usa también 12.18.0 en el perfil y comprueba que `pnpm install --frozen-lockfile` termine en la raíz. Si Prisma o esbuild quedan bloqueados, consulta la [configuración de pnpm](setup.md#1-instalar-dependencias).

Abre el enlace del build terminado en Android, descarga el APK e instálalo. Si Android lo solicita, permite instalar desde la app que abrió el archivo. Abre FlowSaldo sin Metro. Para probar el APK generado desde este código, inicia sesión con `prueba@flowsaldo.test` y `FlowSaldo-Prueba-2026`. Para el piloto conectado, registra el build, el modelo y la versión de Android y ejecuta la siguiente lista.

| Prueba | Resultado esperado |
|---|---|
| Inicio de sesión y reapertura después de cerrar la app | La sesión activa se recupera desde SecureStore y la API valida su vigencia. |
| Revocación de esa sesión desde una segunda sesión autorizada y reapertura | La sesión revocada vuelve a la pantalla de acceso. |
| Exportación de movimientos filtrados y compartir con una segunda app | El archivo recibido conserva nombre CSV, encabezados y filas del filtro. |
| Navegación con TalkBack en acceso, Panel y exportación | Los controles tienen nombres comprensibles y el foco sigue el orden visual. |
| Fuente del sistema ampliada | Los campos, errores y botones principales se leen y se pueden activar. |

La prueba automatizada de HTTPS usa OpenSSL para crear un certificado temporal y verifica una sesión activa y otra revocada en la API. El certificado público, el APK firmado y la prueba física se verifican en el entorno del piloto.

Referencias oficiales de Expo. [Compilar APK](https://docs.expo.dev/build-reference/apk/) · [Variables de entorno](https://docs.expo.dev/eas/environment-variables/)
