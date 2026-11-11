# FlowSaldo

FlowSaldo es una aplicación de finanzas personales para Android y web. Puedes registrar ingresos y gastos, organizar movimientos por categoría, definir presupuestos y exportar el historial a CSV. El modo conectado añade cuentas, tarjetas, préstamos y conciliación manual. El proyecto está preparado para una instalación personal con datos de prueba.

## Empieza por aquí

| Quiero… | Ruta |
|---|---|
| Probar la app en Android | [Descargar el APK de prueba](https://github.com/AndersonACP25/FlowSaldo/releases/tag/0.10.0-preview.1) |
| Ejecutar el código en mi PC | [Clonar y abrir la demo](#clonar-y-abrir-la-demo) |
| Usar mi propia API y base de datos | [Configurar PostgreSQL y la API](docs/setup.md#3-arrancar-la-api-y-el-worker) |
| Generar mi propio APK | [Configurar EAS y compilar](docs/pilot.md#compilar-e-instalar-el-apk) |

Para probar el APK, abre la release, descarga **FlowSaldo-v0.10.0-preview.apk** desde **Assets**, instálalo y pulsa **Explorar demostración**. La demo funciona sin servidor. La instalación del APK se probó en un teléfono físico.

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

Abre la dirección que muestra Expo e inicia sesión con el usuario de prueba `prueba@flowsaldo.test` y la contraseña `FlowSaldo-Prueba-2026`. Estos datos se guardan en el dispositivo. Para usar Expo Go en un teléfono compatible, ejecuta `pnpm start`. Para un emulador Android iniciado, ejecuta `pnpm android`.

## Conectar tu propia instalación

Docker Compose ejecuta PostgreSQL. Después de configurar la base, `pnpm db:setup` prepara las tablas y `pnpm dev` arranca la web, la API y el worker juntos. Usa **Registrarse** para crear tu cuenta personal. La [guía de instalación](docs/setup.md) indica cómo configurar los archivos `.env`, preparar las tablas, arrancar los servicios y crear tu primera cuenta. Si el APK debe conectarse desde un teléfono, prepara una URL HTTPS accesible y configúrala antes de compilar. [Guía del piloto Android](docs/pilot.md)

Los saldos son registros que introduces en FlowSaldo. El importador actual trabaja con avisos sintéticos. Gmail y los avisos bancarios reales siguen pendientes.

## Orientarse en el código

| Ruta | Contenido |
|---|---|
| `apps/mobile` | Interfaz Expo para Android y web |
| `apps/api` | API Express, acceso personal y operaciones financieras |
| `apps/worker` | Procesamiento de avisos sintéticos |
| `packages/domain` | Reglas financieras y lógica compartida |
| `packages/database` | Prisma y migraciones de PostgreSQL |

[Arquitectura](docs/architecture.md) · [API](docs/api.md) · [Pruebas](TESTING.md) · [Contribuir](CONTRIBUTING.md) · [Orquestación](ai/README.md) · [Mantenimiento de datos](docs/maintenance.md) · [Historial de cambios](CHANGELOG.md) · [Roadmap](docs/roadmap.md)
