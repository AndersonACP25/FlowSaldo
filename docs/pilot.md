# Piloto Android y HTTPS

Usa una instancia de pruebas con datos ficticios, un nombre DNS accesible desde el teléfono y un certificado válido para ese nombre. El dispositivo debe confiar en la autoridad emisora.

## Preparar la API

1. Prepara PostgreSQL y aplica las migraciones con `pnpm exec prisma migrate deploy --config packages/database/prisma.config.ts`.
2. Configura `DATABASE_URL` y `DEV_API_TOKEN` en el entorno privado del servidor. Genera Prisma con `pnpm db:generate`.
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

Desde `apps/mobile`, inicia sesión en EAS y vincula el proyecto si aún no está asociado. En el entorno `preview` del proyecto en Expo, establece `EXPO_PUBLIC_API_URL` con la URL HTTPS de la API, incluido el puerto si corresponde. Esa variable queda visible en la compilación. Configura la firma del APK con EAS y ejecuta:

```sh
pnpm dlx eas-cli@latest login
pnpm dlx eas-cli@latest build:configure
pnpm dlx eas-cli@latest build --platform android --profile preview
```

Instala el APK del build en el dispositivo. Registra el identificador del build, el modelo del teléfono y su versión de Android.

| Prueba | Resultado esperado |
|---|---|
| Inicio de sesión y reapertura después de cerrar la app | La sesión activa se recupera desde SecureStore y la API valida su vigencia. |
| Revocación de esa sesión desde una segunda sesión autorizada y reapertura | La sesión revocada vuelve a la pantalla de acceso. |
| Exportación de movimientos filtrados y compartir con una segunda app | El archivo recibido conserva nombre CSV, encabezados y filas del filtro. |
| Navegación con TalkBack en acceso, Panel y exportación | Los controles tienen nombres comprensibles y el foco sigue el orden visual. |
| Fuente del sistema ampliada | Los campos, errores y botones principales se leen y se pueden activar. |

La prueba automatizada de HTTPS usa OpenSSL para crear un certificado temporal y verifica una sesión activa y otra revocada en la API. El certificado público, el APK firmado y la prueba física se verifican en el entorno del piloto.

Referencia de configuración de EAS: [Variables de entorno en Expo](https://docs.expo.dev/eas/environment-variables/).
