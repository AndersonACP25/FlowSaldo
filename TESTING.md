# Verificación enfocada

## Política permanente

Las unitarias y Playwright cubren lo relevante del CORE, no una matriz de todo el sistema. Antes de añadir un caso, identificar el riesgo o la regresión que evita. No crear un test por helper/componente, revisar cada pantalla ni repetir en UI las combinaciones ya cubiertas por dominio/API. Esta política prevalece al interpretar instrucciones generales de QA.

| Capa | Alcance actual | Cuándo ejecutarla |
|---|---|---|
| Unitarias de producto | 9 casos CORE en packages/domain/test/core.test.ts: importes, aislamiento monetario, parser, historia de categorías, presupuestos, calendario/confirmación de recurrencias, comparación con base cero y CSV | Cambios de reglas financieras/persistencia |
| Playwright de producto | 3 recorridos independientes a 390 px: registrar/persistir/exportar; confirmar recurrencia/revisión y abrir su movimiento; exportar los 205 resultados API sin cargar páginas y reintentar un aviso fallido | Cambios en esos recorridos críticos |
| API/PostgreSQL | Autorización, validación, migraciones con datos previos, asignaciones archivadas, confirmación concurrente, ledger de recurrencias, paginación/agregaciones/exportación y trazabilidad | Cambios API/worker/Prisma |
| Metro dev | Bundle HTTP 200 y arranque del producto, sin navegar todas las secciones | Cambios de arranque/dependencias; CI Linux/Windows |
| Export guardian | Contrato real de columnas/archivos CSV y XLSX del tooling | Cambios de exportación |
| Contratos IA | Catálogo/planes/entregas, independientes de los tests de producto | Cambios ai/ o contratos/instrucciones |
| Android | Bundle y compatibilidad con SDK instalado; dispositivo para compartir archivos | Cambios nativos |

## Comandos

- `pnpm db:generate` y `pnpm check`: lint, tipos, 9 casos CORE, patrones lingüísticos y 3 pruebas del guardián de exportación. No incluye toda la integración ni UI.
- Aplicar migraciones/seed en PostgreSQL de prueba y ejecutar `node scripts/smoke.mjs` para integración. Nunca usar una base de producción.
- `pnpm test:web`: genera web y ejecuta únicamente los 3 recorridos críticos. El wrapper configura una URL sintética para la API simulada si no existe EXPO_PUBLIC_API_URL; no requiere backend real.
- `pnpm test:dev`: smoke de Metro separado; no sustituye la exportación web ni Android.
- `pnpm ai:validate` y `pnpm ai:test`: verificar contratos del catálogo cuando se modifiquen instrucciones.

Registrar command, status (pass/fail/not_run) y evidence. No afirmar Android físico cuando solo se generó bundle o se verificó viewport móvil web. Si falta un entorno, indicar el límite real en el PR. Las pruebas de compartir archivo en dispositivo quedan pendientes cuando no hay Android disponible.


v0.7: la recuperación de cola se prueba en integración PostgreSQL con reloj controlado: espera entre intentos, límite, lease interrumpido, dueño obsoleto, reencolado concurrente y un único movimiento. Se detiene el worker de smoke antes de esa prueba aislada para evitar consumidores ajenos al escenario. El tercer recorrido Playwright existente añade solo la acción crítica de reintento manual; siguen siendo 9 unitarias CORE y 3 recorridos.
