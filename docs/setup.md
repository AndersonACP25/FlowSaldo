# Ejecutar FlowSaldo desde un clon

Los comandos están escritos para PowerShell en Windows. Abre la carpeta clonada en VS Code y ejecuta los comandos desde la raíz, donde están `package.json` y `pnpm-lock.yaml`.

## 1. Instalar dependencias

Usa Node.js 24.11 o posterior dentro de la serie 24. La versión de pnpm que usa tu clon aparece en `packageManager` del `package.json` raíz. Si necesitas instalarla, por ejemplo para un clon que declara `pnpm@12.18.0`, ejecuta `npm install --global pnpm@12.18.0`.

```powershell
node --version
pnpm --version
pnpm install --frozen-lockfile
```

Si pnpm 12 devuelve `ERR_PNPM_IGNORED_BUILDS` y el archivo `pnpm-workspace.yaml` contiene valores `set this to true or false`, sustituye esos valores y el bloque anterior `onlyBuiltDependencies` por este bloque. Conserva `packages` y `nodeLinker`. Vuelve a ejecutar la instalación.

```yaml
allowBuilds:
  '@prisma/client': true
  '@prisma/engines': true
  esbuild: true
  prisma: true
```

## 2. Abrir la demo

En la PC, ejecuta `pnpm web` y abre la URL que muestra Expo. En Android físico, ejecuta `pnpm start`, conecta ambos dispositivos a la misma red y escanea el QR con Expo Go compatible con la versión de Expo de `apps/mobile/package.json`. Para un emulador Android ya iniciado, ejecuta `pnpm android`.

Inicia sesión con el usuario de prueba `prueba@flowsaldo.test` y la contraseña `FlowSaldo-Prueba-2026`. Los movimientos de prueba se guardan localmente. Este acceso funciona sin API ni PostgreSQL.

## 3. Arrancar la API y el worker

Para probar el modo conectado, inicia Docker Desktop y ejecuta desde la raíz:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
if (-not (Test-Path apps/mobile/.env)) { Copy-Item apps/mobile/.env.example apps/mobile/.env }
docker compose up -d
docker compose ps
```

Espera a que PostgreSQL aparezca `healthy`. Revisa la columna **PORTS**. Si ves `127.0.0.1:5433->5432/tcp`, usa `DATABASE_URL=postgresql://flowsaldo:flowsaldo_local@127.0.0.1:5433/flowsaldo` en el `.env` raíz. Si Compose publica el puerto 5432, usa ese puerto en la URL. El puerto `PORT=3000` de la API es independiente.

```powershell
pnpm db:setup
# Opcional: insertar movimientos de ejemplo en una base de pruebas.
pnpm db:seed
```

Copia las plantillas solo si aún no tienes esos archivos. Antes de arrancar la API, cambia `DEV_API_TOKEN` en el `.env` de la raíz por un secreto aleatorio de al menos 24 caracteres. Usa la base local de Compose o ajusta `DATABASE_URL` si ya tienes PostgreSQL.

Desde la raíz, ejecuta `pnpm dev` para arrancar la web, la API y el worker en una terminal. Usa Ctrl+C para detener los tres procesos. PostgreSQL se administra por separado con Docker Compose.

| Comando | Qué inicia |
|---|---|
| `pnpm dev` | Web, API y worker |
| `pnpm dev:phone` | Expo Go por QR, API y worker |
| `pnpm dev:android` | Expo en un emulador iniciado, API y worker |
| `pnpm web` | Solo la web |
| `pnpm dev:api` / `pnpm dev:worker` | Solo el servicio indicado |

Desde PowerShell, comprueba que la API esté escuchando con `Invoke-RestMethod http://127.0.0.1:3000/health` y que pueda consultar PostgreSQL con `Invoke-RestMethod http://127.0.0.1:3000/auth/status`. Ajusta el puerto si cambiaste `PORT`. La plantilla `.env.example` usa el puerto 5433 de Docker Compose. Si copiaste el archivo antes de este ajuste, revisa el puerto en tu `.env` existente y ejecuta `pnpm db:setup`. Si copiaste la plantilla de la app para la web local, cambia `EXPO_PUBLIC_API_URL` en `apps/mobile/.env` a `http://127.0.0.1:3000`. Si Expo usa un puerto distinto al autorizado, ajusta `WEB_ORIGINS` en el `.env` de la API con el origen exacto de la web.

En un teléfono o emulador, `localhost` apunta al propio dispositivo. Para probar por Wi-Fi con datos ficticios, usa la IPv4 LAN de la PC en `EXPO_PUBLIC_API_URL`, cambia `HOST` a `0.0.0.0` y permite el puerto 3000 en la red privada. Reinicia la API y Expo después de cambiar su configuración. Para un APK conectado al servidor de pruebas, configura HTTPS según la [guía del piloto](pilot.md).

## 4. Crear la cuenta de prueba

1. En la app, pulsa **Registrarse**. Usa un nombre y correo ficticios, una contraseña de al menos 15 caracteres y el secreto de `DEV_API_TOKEN` como token inicial.
2. Pulsa **Ir a iniciar sesión** y entra con la cuenta creada. Desde ese momento, la API autentica los datos mediante la sesión personal.
3. En **Conexiones**, usa el importador sintético para probar el worker. Los avisos que requieren confirmación aparecen en **Por revisar**.

El secreto inicial pertenece al `.env` privado de la API. `EXPO_PUBLIC_API_URL` es una URL visible en la app. La demo y los datos de PostgreSQL se consultan por separado.

## 5. Comprobar y generar el APK

```powershell
pnpm check
pnpm ai:validate
pnpm ai:test
```

Para Playwright, instala Chromium con `pnpm exec playwright install chromium` y ejecuta `pnpm test:web`. Consulta [TESTING.md](../TESTING.md) para el smoke de integración con PostgreSQL y la prueba de Metro.

Para generar un APK instalable, sigue [la guía EAS y Android](pilot.md#compilar-e-instalar-el-apk). El APK de demostración puede usarse sin servidor. El modo conectado requiere que el teléfono llegue a la URL HTTPS incluida en la compilación.

## Diagnosticar un error al arrancar

- Si `/health` responde pero `/auth/status` falla, comprueba PostgreSQL con `docker compose ps`, revisa `DATABASE_URL` y aplica `pnpm db:setup`. Reinicia la API si cambiaste su configuración.
- Si el error aparece antes de que se muestre la app y Expo indica `Metro` o `bundle`, revisa el primer error de la terminal de Expo. Puedes aislar la interfaz con `pnpm web` en la PC o `pnpm start` para Expo Go, y probar con el usuario de demo.
