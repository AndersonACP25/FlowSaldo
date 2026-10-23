# Verificación

| Cambio | Comprobaciones requeridas |
|---|---|
| Código TypeScript/producto | pnpm db:generate; pnpm check |
| Dominio monetario | npm test, incluyendo monedas, fechas, duplicados y límites relevantes |
| API/worker/Prisma | Migración y seed PostgreSQL de prueba; node scripts/smoke.mjs |
| UI web | pnpm test:web con Chromium instalado |
| Arranque Expo/Metro | pnpm test:dev en Windows y Linux |
| Cambios nativos | Bundle Android; prueba en dispositivo/emulador cuando aplique |
| Infraestructura ai/ | pnpm ai:validate; pnpm ai:test; comprobar ai:plan y ai:packet |
| Solo documentación | Enlaces locales del catálogo y comandos afectados; no inventar ejecución de pruebas del producto |

pnpm check ejecuta lint, tipos y dominio, no todas las pruebas de integración o UI. test:web prueba un export; test:dev cubre Metro dev. Consultar README para prerrequisitos. No afirmar Android físico cuando solo se probó viewport móvil web.

Cada tarea declara requiredChecks concretos. Registrar command, status (pass/fail/not_run) y evidence. Si falta entorno, informar blocked. El validador de entregas verifica consistencia declarada; el orquestador contrasta la evidencia con logs reales.

Cambios v0.5: pnpm text:check; pnpm exports:test (crea y valida Excel/CSV sintéticos); pnpm ai:validate y pnpm ai:test para los doce perfiles. El flujo web cubre vistas previas sin credenciales enviadas, conteo singular y preferencias persistidas.
