# FlowSaldo ↗ · v0.3

Base Android de finanzas personales: React Native + Expo + TypeScript, Express, worker y PostgreSQL con Prisma.

**Estado:** prototipo personal de desarrollo. La app abre en modo demo sin backend. No conecta Gmail/Outlook ni interpreta correos bancarios reales. El parser solo reconoce el formato sintético documentado. No usar datos financieros reales ni exponer esta API a Internet.

## Requisitos

- Node.js 24 LTS (>=24.11), npm y Git.
- VS Code y Expo Go compatible con el SDK indicado en `apps/mobile/package.json`.
- Docker Desktop con Compose para la API; también puedes usar PostgreSQL local.
- Cuenta Expo solo para compilar en EAS. Android Studio es opcional con teléfono físico y compilación en la nube.

## Primer arranque: Android o PC

En PowerShell:

```powershell
git clone https://github.com/AndersonACP25/FlowSaldo.git
cd FlowSaldo
# Si el PR de v0.3 no se ha integrado:
# git switch feature/v3-dark-review
npm ci
npm start
```

Conecta PC y Android al mismo Wi-Fi, abre Expo Go y escanea el QR. Si la red impide conectar: `npm exec -w @flowsaldo/mobile -- expo start --go --tunnel`.

Para abrir en la PC: `npm run web`. Para Expo Go: `npm start`. Para un emulador Android encendido: `npm run android`. Ejecuta todo desde la raíz. Las dependencias web ya están incluidas.

La navegación sigue DESIGN.md: Panel, Movimientos, Por revisar y Conexiones, con una paleta Dark Slate/esmeralda/cian. Panel muestra el flujo de los últimos siete días. Por revisar permite confirmar datos manualmente o descartar correos sintéticos; solo los confirmados generan movimientos. Conexiones muestra el estado real del prototipo y permite encolar avisos sintéticos al worker cuando conectas la API. Gmail y Outlook están marcados como próximos, sin conexión ni IA activa.

La demo permite crear, editar y eliminar movimientos con confirmación, buscar por descripción/categoría, filtrar mes/moneda/tipo, ver gastos por categoría, guardar presupuesto por mes/moneda y exportar el conjunto filtrado. En web se descarga CSV; Android comparte el texto CSV mediante el menú nativo. Los movimientos demo y presupuestos persisten con AsyncStorage (almacenamiento sin cifrar, solo datos ficticios), separados de la API. La sesión y token API nunca se guardan. Conexiones permite restablecer la demo con confirmación. Las muestras iniciales se ubican en el mes actual al iniciar una demo nueva.

Los indicadores se calculan por mes y moneda. En modo API el alcance es hasta 200 registros del mes seleccionado. Los presupuestos son locales al dispositivo y se separan por modo demo/API, mes y moneda; no se sincronizan con el servidor. Los totales corresponden al conjunto del mes mostrado; no son saldos bancarios. Si Expo Go no soporta este SDK, instala una versión compatible desde https://expo.dev/go o crea un development build. No uses credenciales reales en el prototipo.

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
4. Reinicia Expo. En Conexiones escribe el mismo DEV_API_TOKEN y pulsa Conectar.

El token queda solo en memoria. EXPO_PUBLIC_* es público: nunca pongas secretos allí. HTTP LAN y token compartido son únicamente para datos sintéticos en una red confiable. El APK definitivo requiere HTTPS y autenticación individual. Esta base no incluye login multiusuario. Para web usa `http://localhost:3000` en EXPO_PUBLIC_API_URL y el puerto Expo predeterminado 8081. La API permite CORS exclusivamente desde WEB_ORIGINS (localhost:8081 por defecto). Si cambias puerto u origen, actualiza esa variable. El permiso CORS no sustituye el token.

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
# Opcional: prueba de interfaz web (instala Chromium una vez)
npx playwright install chromium
npm run test:web
# Prueba el servidor de desarrollo y la URL del bundle reportada
npm run test:dev
```

Pruebas de dominio ejecutables sin instalar dependencias: `node --test packages/domain/test/*.test.ts` (Node 24).
CI verifica instalación con lockfile, Prisma, lint, tipos, dominio, smoke de API/worker contra PostgreSQL y un flujo Playwright web (persistencia, CRUD, filtros, presupuesto y CSV).

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

## Memoria del proyecto

[MEMORY.md](MEMORY.md) registra decisiones, alcance y validación. No incluir datos personales ni secretos en ese archivo.

## Diagnóstico del 500 en el bundle web

La ruta `/apps/mobile/index.ts.bundle?...` es un recurso generado por Metro, no un endpoint de Express. La versión 0.3 inicia Expo desde apps/mobile y limpia la caché con `--clear` mediante un launcher Node compatible con Windows. La URL reportada se prueba en CI con dev=true, lazy=true y transform.engine=hermes en Windows y Linux, además de cargar la interfaz en navegador.

Si vienes de una versión anterior, detén Metro (Ctrl+C) y ejecuta desde la raíz:

```powershell
npm ci
npm run web
```

Si vuelve a devolver 500, copia el cuerpo de esa respuesta y el error de la terminal Metro: el código de estado por sí solo no identifica la causa. Comprueba Node 24 con `node --version`. No necesitas iniciar PostgreSQL para abrir la demo. La URL reportada respondió 200 en la reproducción con instalación limpia; no se confirmó la causa del fallo original de tu PC.

## Actualización de datos v0.2 -> v0.3

Se conserva la clave local `flowsaldo.demo.v2` para no borrar movimientos ni presupuestos. Si faltan revisiones, se agregan las muestras sintéticas iniciales al leer los datos. Las revisiones confirmadas o descartadas se guardan junto con la demo. Para API aplica `npm run db:migrate` después de actualizar: añade DISMISSED sin borrar tablas.
