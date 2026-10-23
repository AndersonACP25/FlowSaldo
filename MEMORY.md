# FlowSaldo — memoria del proyecto

Última actualización: 2026-10-22. Versión 0.3.0.

## Objetivo

App Android de finanzas personales a partir de notificaciones bancarias por correo. La versión web permite desarrollar y explorar la interfaz en PC. El proyecto está en fase de prototipo personal con datos sintéticos.

## Arquitectura y herramientas

Monorepo npm: apps/mobile (Expo, React Native, React Query), apps/api (Express, Zod, CORS), apps/worker (cola PostgreSQL), packages/domain (reglas puras TypeScript), packages/database (Prisma 7 y PostgreSQL). Node 24 LTS. Docker Compose opcional si PostgreSQL ya está instalado. No microservicios ni agentes en runtime.

## Comandos desde la raíz

- npm ci: instalar con lockfile.
- npm start: abrir servidor para Expo Go; escanear QR desde Android.
- npm run web: abrir en navegador de la PC.
- npm run android: abrir en emulador Android ya configurado.
- npm run dev:api / npm run dev:worker: servicios locales, con .env configurado.
- npm run db:generate / db:migrate / db:seed: preparar PostgreSQL.
- npm run check: lint, tipos y pruebas de dominio.

## Estado funcional v0.3

- DESIGN.md es la fuente del diseño: Dark Slate (#0a0e16), esmeralda (#10b981), cian (#06b6d4). Navegación inferior Panel, Movimientos, Por revisar y Conexiones. Tema centralizado.
- Flujo semanal calculado desde movimientos, sin métricas simuladas de latencia, IA o uptime.
- Revisión manual demo/API: ver correo sintético, confirmar datos o descartar; bloqueo transaccional en API evita duplicados concurrentes. Gmail/Outlook solo muestran próximos, sin OAuth.
- Demo persistente, registro/edición/eliminación manual con confirmación.
- Filtros por mes, moneda, tipo y texto; gastos por categoría.
- Presupuesto local por modo, mes y moneda, con indicador y exceso.
- Exportación CSV: descarga web; compartir texto en Android.
- API: creación, edición, eliminación y consulta de movimientos por mes/moneda; importación sintética y resumen histórico.
- Parser exclusivamente FLOWSALDO-DEMO. Cualquier formato desconocido -> REVIEW.

## Decisiones e invariantes

- amountMinor es un entero positivo en centavos, máximo 2147483647 por movimiento. No usar float para interpretar entradas monetarias.
- DOP y USD permanecen separados; no hay tasa de cambio implícita.
- TRANSFER representa traslado entre cuentas propias; se excluye de ingresos y gastos.
- No confundir diferencia registrada con saldo bancario.
- externalId e importId únicos; worker transaccional con FOR UPDATE SKIP LOCKED.
- AsyncStorage no está cifrado. Solo demo y presupuestos ficticios, nunca tokens ni correos reales.
- Token API en memoria; .env fuera de Git. EXPO_PUBLIC_* nunca contiene secretos.
- CORS solo desde WEB_ORIGINS configurados; autorización Bearer sigue siendo obligatoria.

## Límites y pendientes

No hay OAuth Gmail/Outlook, parsers bancarios reales, usuarios ni autenticación de producción. No conectar información bancaria real. Los listados API devuelven como máximo 200 movimientos por mes/moneda; los indicadores de la app usan ese conjunto. Los presupuestos no se sincronizan entre dispositivos. No hay gestión de deuda, devoluciones ni conciliación. No hay paginación completa. Restablecer demo no borra PostgreSQL.

La exportación nativa comparte texto CSV; adjuntar un archivo CSV nativo queda pendiente. Confirmar comportamiento en Android físico y generar APK en EAS sigue pendiente.

## Verificación

Validación local v0.3: npm run check aprobado (14 pruebas), dependencias Expo compatibles, bundles web/Android exportados y flujo Playwright aprobado a 1440 y 390 px. El flujo cubre crear/editar/eliminar, cancelación, persistencia tras recarga, presupuesto, mes/moneda, descarga CSV, confirmación/descarte de revisiones y navegación Conexiones. La prueba adicional de Metro dev pasó con bundle HTTP 200 y carga en navegador. No se probó en Android físico. CI incluye PostgreSQL y smoke de API/worker (autorización, validación, persistencia, idempotencia, REVIEW, filtros, CORS y CRUD). Registrar el resultado concreto en el PR; no dar por aprobado un paso pendiente.

## Siguiente fase

Identidad de usuario, HTTPS y política de datos; elegir proveedor de correo y un banco, reunir muestras anonimizadas y desarrollar OAuth y parser versionado. Añadir paginación y conciliación antes de reportes con datos reales.

## Arranque web y 500 reportado

Un 500 en index.ts.bundle es de Metro. Con instalación limpia la URL dev reportada respondió 200; falta el cuerpo del error original para confirmar su causa. scripts/expo.mjs ejecuta Expo desde apps/mobile, comprueba dependencias web y limpia caché. scripts/dev-smoke.mjs verifica la URL exacta y carga la app en navegador. CI lo ejecuta en Windows y Linux. No afirmar que se identificó una causa sin evidencia.

## Datos y migración v0.3

Se conserva la clave AsyncStorage v2. Se inicializan revisiones sintéticas si el registro v2 no las contiene. Migración aditiva agrega DISMISSED. Los pendientes no afectan totales hasta confirmación. No hay confirmación automática ni IA. Confirmación manual usa /imports/:id/resolve; descarte usa /dismiss; detalle autorizado /imports/:id devuelve cuerpo.
