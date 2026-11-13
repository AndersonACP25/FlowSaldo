# FlowSaldo

FlowSaldo es una aplicación de finanzas personales para Android y web. Puedes registrar ingresos y gastos, organizar movimientos por categoría, definir presupuestos y exportar el historial a CSV. El modo conectado añade cuentas, tarjetas, préstamos y conciliación manual. El proyecto está preparado para una instalación personal con datos de prueba.

## Stack tecnológico

| Área                           | Tecnología                                                                   |
| ------------------------------ | ---------------------------------------------------------------------------- |
| Android y web                  | Expo SDK 58, React 19, React Native, React Native Web y TypeScript           |
| Consultas y persistencia local | TanStack Query, AsyncStorage y Expo SecureStore para la sesión nativa        |
| API y worker                   | Node.js 24, Express 5, Zod y TypeScript                                      |
| Base de datos                  | PostgreSQL 17, Prisma 7 y Docker Compose para desarrollo local               |
| Monorepo y compilación         | pnpm workspaces, Metro y EAS Build                                           |
| Calidad                        | ESLint, comprobación de tipos, Node Test Runner, Playwright y GitHub Actions |
| Tasas de referencia            | [Frankfurter v2](https://frankfurter.dev/es/) para USD/DOP y EUR/DOP         |

## Empieza por aquí

| Quiero…                            | Ruta                                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Probar la app en Android           | [Descargar el APK de prueba](https://github.com/AndersonACP25/FlowSaldo/releases/tag/0.10.0-preview.1) |
| Ejecutar el código en mi PC        | [Clonar y abrir la demo](#clonar-y-abrir-la-demo)                                                      |
| Usar mi propia API y base de datos | [Configurar PostgreSQL y la API](docs/setup.md#3-arrancar-la-api-y-el-worker)                          |
| Generar mi propio APK              | [Configurar EAS y compilar](docs/pilot.md#compilar-e-instalar-el-apk)                                  |

Para probar el APK, abre la release, descarga **FlowSaldo-v0.10.0-preview.apk** desde **Assets**, instálalo y pulsa **Explorar demostración**. Esa release incluye una APK ya compilada y probada en un teléfono físico. Para probar los cambios del código actual en Android, compila una APK desde tu clon.

## Clonar y abrir la demo

Necesitas Git, Node.js 24.11 o posterior dentro de la serie 24 y la versión de pnpm que figura en `packageManager` del `package.json` raíz. Puedes usar **Fork** en GitHub para mantener tu propia copia y clonar la URL de ese fork.

```powershell
git clone https://github.com/AndersonACP25/FlowSaldo.git
cd FlowSaldo
node --version
pnpm --version
```

Revisa la sección de [instalación de dependencias](docs/setup.md#1-instalar-dependencias) si pnpm aún no está instalado o muestra `ERR_PNPM_IGNORED_BUILDS`. Luego ejecuta desde la raíz:

```powershell
pnpm install --frozen-lockfile
pnpm web
```

Abre la dirección que muestra Expo e inicia sesión con el usuario de prueba `prueba@flowsaldo.test` y la contraseña `FlowSaldo-Prueba-2026`. Los movimientos de prueba se guardan en el dispositivo. La demo funciona sin API de FlowSaldo ni PostgreSQL. La consulta de Tasas requiere Internet.

## Formas de ejecutar FlowSaldo

Ejecuta los comandos desde la raíz tras instalar las dependencias. Prepara la base y los archivos de entorno solo para el modo conectado.

| Destino                         | Solo interfaz y demo          | Con API y worker                  |
| ------------------------------- | ----------------------------- | --------------------------------- |
| Navegador                       | `pnpm web`                    | `pnpm dev`                        |
| Teléfono con Expo Go compatible | `pnpm start` y escanear el QR | `pnpm dev:phone` y escanear el QR |
| Emulador Android iniciado       | `pnpm android`                | `pnpm dev:android`                |

- **Procesos separados**. Ejecuta `pnpm dev:api` y `pnpm dev:worker` en terminales independientes y abre la interfaz con el comando de la primera columna.
- **Web estática**. Desde `apps/mobile`, ejecuta `pnpm exec expo export --platform web` y sirve la carpeta `dist` por HTTP. Para el modo conectado, configura `EXPO_PUBLIC_API_URL` antes de exportar y autoriza el origen web en `WEB_ORIGINS` de la API.
- **APK instalable**. Desde `apps/mobile`, ejecuta `pnpm dlx eas-cli@latest build --platform android --profile preview` después de [vincular tu proyecto EAS](docs/pilot.md#compilar-e-instalar-el-apk). Configura el entorno EAS `preview` si la APK usará tu API por HTTPS.

## Conectar tu propia instalación

Docker Compose ejecuta PostgreSQL. Después de configurar Docker y el archivo `.env`, `pnpm setup:local` instala las dependencias y prepara la base y `pnpm dev` arranca la web, la API y el worker juntos. Usa **Registrarse** para crear tu cuenta personal. La [guía de instalación](docs/setup.md) indica cómo configurar los archivos `.env`, preparar las tablas, arrancar los servicios y crear tu primera cuenta. Si el APK debe conectarse desde un teléfono, prepara una URL HTTPS accesible y configúrala antes de compilar. [Guía del piloto Android](docs/pilot.md)

Desde **Inicio → Tasas** puedes consultar valores recientes o históricos y estimar conversiones a DOP. Las tasas son de referencia. Los movimientos y presupuestos se registran en DOP y USD.

Los saldos son registros que introduces en FlowSaldo. En **Conexiones → Laboratorio de correo sintético**, el importador prepara retiros aprobados en DOP de BHD y Popular para confirmación manual. La sincronización con Gmail y los demás formatos de bancos dominicanos y PayPal siguen pendientes. [Formatos admitidos](docs/api.md#avisos-bancarios-de-prueba)

## Comandos rápidos

Ejecuta estos comandos desde la raíz del proyecto.

| Comando                                          | Cuándo usarlo                                                                                                                                   |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm setup:local`                               | En un clon nuevo con PostgreSQL activo y `.env` configurado. Instala las dependencias, genera Prisma y aplica migraciones.                      |
| `pnpm db:setup`                                  | Si ya instalaste las dependencias y solo necesitas preparar la base.                                                                            |
| `pnpm dev --port 8082`                           | Para iniciar web, API y worker cuando Expo no puede usar 8081. Agrega `http://localhost:8082` a `WEB_ORIGINS` si abres la web en esa dirección. |
| `pnpm web --port 8082`                           | Para abrir solo la interfaz y probar la demo.                                                                                                   |
| `pnpm doctor:expo`                               | Para comprobar si Node encuentra Expo desde el paquete móvil.                                                                                   |
| `pnpm doctor:api`                                | Con la API activa, para verificar PostgreSQL y el estado de la cuenta.                                                                          |
| `pnpm format apps/api/src/views/errors.ts`       | Para aplicar Prettier al archivo o directorio indicado.                                                                                         |
| `pnpm format:check apps/api/src/views/errors.ts` | Para revisar el formato del archivo sin modificarlo.                                                                                            |

## Formato y notificaciones

Ejecuta `pnpm format apps packages scripts` para aplicar Prettier al código que valida CI. Usa `pnpm format:check apps packages scripts` para verificarlo.

En la APK de Android, entra en **Configuración → Activar notificaciones**. FlowSaldo puede avisar al guardar ingresos o transferencias y al confirmar avisos bancarios o movimientos recurrentes. Los avisos son locales y se generan en el dispositivo que confirma la operación. Se requiere recompilar la APK para incorporar este módulo. La notificación no muestra montos ni cuentas.

Consulta [cómo publicar una APK y avisar de una actualización](docs/pilot.md#avisar-de-una-apk-nueva).

## Próximo feature

[Plan de importación de avisos bancarios con Gmail](docs/plan-feature.md)

## Orientarse en el código

| Ruta                        | Contenido                                                        |
| --------------------------- | ---------------------------------------------------------------- |
| `apps/mobile`               | Interfaz Expo para Android y web                                 |
| `apps/mobile/src/Servicios` | Consulta de tasas externas, independiente de la API de FlowSaldo |
| `apps/api`                  | API Express, acceso personal y operaciones financieras           |
| `apps/worker`               | Procesamiento de avisos sintéticos                               |
| `packages/domain`           | Reglas financieras y lógica compartida                           |
| `packages/database`         | Prisma y migraciones de PostgreSQL                               |

[Arquitectura](docs/architecture.md) · [API](docs/api.md) · [Pruebas](TESTING.md) · [Contribuir](CONTRIBUTING.md) · [Orquestación](ai/README.md) · [Mantenimiento de datos](docs/maintenance.md) · [Historial de cambios](CHANGELOG.md) · [Roadmap](docs/roadmap.md)
