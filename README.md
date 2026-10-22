# FlowSaldo ↗

Base Android de finanzas personales: React Native + Expo + TypeScript, Express, worker y PostgreSQL con Prisma.

**Estado:** prototipo personal de desarrollo. La app abre en modo demo sin backend. No conecta Gmail/Outlook ni interpreta correos bancarios reales. El parser solo reconoce el formato sintético documentado. No usar datos financieros reales ni exponer esta API a Internet.

## Requisitos

- Node.js 24 LTS (>=24.11), npm y Git.
- VS Code y Expo Go compatible con el SDK indicado en `apps/mobile/package.json`.
- Docker Desktop con Compose para la API; también puedes usar PostgreSQL local.
- Cuenta Expo solo para compilar en EAS. Android Studio es opcional con teléfono físico y compilación en la nube.

## Primer arranque: solo Android demo

En PowerShell:

```powershell
git clone https://github.com/AndersonACP25/FlowSaldo.git
cd FlowSaldo
# Si el PR inicial no se ha integrado:
# git switch feature/initial-foundation
npm ci
npm run dev:mobile
```

Conecta PC y Android al mismo Wi-Fi, abre Expo Go y escanea el QR. Si la red impide conectar: `npm run dev:mobile -- --tunnel`.

La demo muestra datos ficticios, permite cambiar moneda y navegar entre Resumen, Movimientos y Conexión. Los totales corresponden al conjunto mostrado; no son saldos bancarios ni reportes mensuales. Si Expo Go no soporta este SDK, instala una versión compatible desde https://expo.dev/go o crea un development build. No uses credenciales reales en el prototipo.

## API, base de datos y worker

Desde la raíz:

```powershell
Copy-Item .env.example .env
# Cambia DEV_API_TOKEN por un secreto aleatorio de 24 caracteres o más.
docker compose up -d
npm run db:generate
npm run db:migrate -- --name initial
npm run db:seed
npm run dev:api
```

En otra terminal: `npm run dev:worker`. Ejecuta cada comando desde la raíz. Si usas PostgreSQL instalado, omite Docker y ajusta DATABASE_URL. Las credenciales del compose son exclusivamente locales.

Para conectar el teléfono:

1. Copia `apps/mobile/.env.example` a `apps/mobile/.env`.
2. Cambia EXPO_PUBLIC_API_URL por la IP LAN de tu PC (consulta `ipconfig`). `localhost` desde Android es el teléfono.
3. Cambia HOST a `0.0.0.0` en `.env` y reinicia API; permite el puerto 3000 solo en tu red privada si Windows lo requiere.
4. Reinicia Expo. En Conexión escribe el mismo DEV_API_TOKEN y pulsa Conectar.

El token queda solo en memoria. EXPO_PUBLIC_* es público: nunca pongas secretos allí. HTTP LAN y token compartido son únicamente para datos sintéticos en una red confiable. El APK definitivo requiere HTTPS y autenticación individual. Esta base no incluye login multiusuario.

## Probar una importación (PowerShell)

```powershell
$token = 'EL_TOKEN_QUE_CONFIGURASTE'
$headers = @{ Authorization = "Bearer $token" }
$body = @{ externalId = 'demo-mail-001'; body = 'FLOWSALDO-DEMO|EXPENSE|DOP|2450.50|2026-10-21|Supermercado' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:3000/imports -Headers $headers -ContentType application/json -Body $body
Invoke-RestMethod -Uri http://localhost:3000/imports -Headers $headers
Invoke-RestMethod -Uri http://localhost:3000/movements -Headers $headers
```

Repetir externalId no crea otro trabajo. El worker transforma PENDING en PARSED o REVIEW. Los desconocidos no se contabilizan. Los correos sintéticos procesados correctamente se vacían; los pendientes de revisión conservan el cuerpo para investigación local. Falta definir retención y eliminación antes de usar correos reales. El límite por movimiento es 2,147,483,647 centavos.

## Calidad

```powershell
npm run db:generate
npm run check
```

Pruebas de dominio ejecutables sin instalar dependencias: `node --test packages/domain/test/*.test.ts` (Node 24).
CI verifica instalación con lockfile, Prisma, lint, tipos, dominio y un smoke de API/worker contra PostgreSQL.

## Generar un APK

```powershell
cd apps/mobile
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build --platform android --profile preview
```

EAS pedirá vincular el proyecto y configurar firma. Abre el enlace final en Android y descarga el APK. El perfil preview no necesita Metro ni la PC encendida para mostrar la demo. Con API conectada, necesita acceso al servidor. La compilación no se ha ejecutado como parte de esta entrega.

Para un development build primero instala `expo-dev-client` mediante `npx expo install expo-dev-client`; luego compila con `--profile development`. No contiene aún OAuth bancario ni permisos especiales.

## Organización

| Ruta | Responsabilidad |
|---|---|
| apps/mobile | App Expo, React Query y demo |
| apps/api | API Express, Zod, token personal de desarrollo |
| apps/worker | Importación persistida y procesamiento asíncrono |
| packages/domain | Reglas puras, parser sintético y pruebas |
| packages/database | Prisma, migración, seed y cliente PostgreSQL |
| docs | Arquitectura, contrato API y próximos pasos |

Consulta [arquitectura](docs/architecture.md), [API](docs/api.md) y [roadmap](docs/roadmap.md).
