# Ejecutar FlowSaldo desde un clon

Los comandos están escritos para PowerShell en Windows. Abre la carpeta clonada en VS Code y ejecuta los comandos desde la raíz, donde están `package.json` y `pnpm-lock.yaml`.

## 1. Instalar dependencias

Requisitos del repositorio: Node.js 24.11 o posterior dentro de la serie 24 y pnpm 10.34.7.

```powershell
node --version
npm install --global pnpm@10.34.7
pnpm --version
pnpm install --frozen-lockfile
```

Si pnpm ya está en esa versión, omite su instalación. Usa pnpm para las dependencias del proyecto.

## 2. Abrir la demo

En la PC, ejecuta `pnpm web` y abre la URL que muestra Expo. En Android físico, ejecuta `pnpm start`, conecta ambos dispositivos a la misma red y escanea el QR con Expo Go compatible con la versión de Expo de `apps/mobile/package.json`. Para un emulador Android ya iniciado, ejecuta `pnpm android`.

Pulsa **Explorar demostración**. Los movimientos de prueba se guardan localmente. La demo puede ejecutarse sin API ni PostgreSQL.

## 3. Arrancar la API y el worker

Para probar el modo conectado, inicia Docker Desktop y ejecuta desde la raíz:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
if (-not (Test-Path apps/mobile/.env)) { Copy-Item apps/mobile/.env.example apps/mobile/.env }
docker compose up -d
docker compose ps
# Espera a que PostgreSQL aparezca healthy antes de aplicar las migraciones.
pnpm db:generate
pnpm exec prisma migrate deploy --config packages/database/prisma.config.ts
# Opcional: insertar movimientos de ejemplo en una base de pruebas.
pnpm db:seed
```

Copia las plantillas solo si aún no tienes esos archivos. Antes de arrancar la API, cambia `DEV_API_TOKEN` en el `.env` de la raíz por un secreto aleatorio de al menos 24 caracteres. Usa la base local de Compose o ajusta `DATABASE_URL` si ya tienes PostgreSQL.

| Terminal | Comando desde la raíz |
|---|---|
| API | `pnpm dev:api` |
| Worker de importaciones | `pnpm dev:worker` |
| Interfaz web o Android | `pnpm web` o `pnpm start` |

Desde PowerShell, comprueba la API con `Invoke-RestMethod http://127.0.0.1:3000/health`. Para la web local, cambia `EXPO_PUBLIC_API_URL` en `apps/mobile/.env` a `http://127.0.0.1:3000`. Si Expo usa un puerto distinto al autorizado, ajusta `WEB_ORIGINS` en el `.env` de la API con el origen exacto de la web.

En un teléfono o emulador, `localhost` apunta al propio dispositivo. Para probar por Wi-Fi con datos ficticios, usa la IPv4 LAN de la PC en `EXPO_PUBLIC_API_URL`, cambia `HOST` a `0.0.0.0` y permite el puerto 3000 en la red privada. Reinicia la API y Expo después de cambiar su configuración. Para un APK conectado al servidor de pruebas, configura HTTPS según la [guía del piloto](pilot.md).

## 4. Crear la cuenta de prueba

1. En la app, pulsa **Configurar cuenta inicial**. Usa un nombre y correo ficticios, una contraseña de al menos 15 caracteres y el secreto de `DEV_API_TOKEN` como token inicial.
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
