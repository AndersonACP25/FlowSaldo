# Verificación enfocada

## Política permanente

Las unitarias y Playwright cubren lo relevante del CORE, no una matriz de todo el sistema. Antes de añadir un caso, identificar el riesgo o la regresión que evita. No crear un test por helper/componente, revisar cada pantalla ni repetir en UI las combinaciones ya cubiertas por dominio/API. Esta política prevalece al interpretar instrucciones generales de QA.

| Capa | Alcance actual | Cuándo ejecutarla |
|---|---|---|
| Unitarias de producto | 9 casos CORE en packages/domain/test/core.test.ts: importes, aislamiento monetario, parser, historia de categorías, presupuestos, calendario/confirmación de recurrencias, comparación con base cero y CSV | Cambios de reglas financieras/persistencia |
| Playwright de producto | 5 recorridos independientes a 390 px: registrar/persistir/exportar; confirmar recurrencia/revisión y abrir su movimiento; exportar los 205 resultados API sin cargar páginas y reintentar un aviso fallido; acceso/cambio de contraseña/cierre | Cambios en esos recorridos críticos |
| API/PostgreSQL | Autorización, validación, migraciones con datos previos, asignaciones archivadas, confirmación concurrente, ledger de recurrencias, paginación/agregaciones/exportación y trazabilidad | Cambios API/worker/Prisma |
| Metro dev | Bundle HTTP 200 y arranque del producto, sin navegar todas las secciones | Cambios de arranque/dependencias; CI Linux/Windows |
| Export guardian | Contrato real de columnas/archivos CSV y XLSX del tooling | Cambios de exportación |
| Contratos IA | Catálogo/planes/entregas, independientes de los tests de producto | Cambios ai/ o contratos/instrucciones |
| Android | Bundle y compatibilidad con SDK instalado; dispositivo para compartir archivos | Cambios nativos |

## Comandos

- `pnpm db:generate` y `pnpm check`: lint, tipos, 9 casos CORE, patrones lingüísticos y 3 pruebas del guardián de exportación. No incluye toda la integración ni UI.
- Aplicar migraciones/seed en PostgreSQL de prueba y ejecutar `node scripts/smoke.mjs` para integración. Nunca usar una base de producción.
- `pnpm test:web`: genera web y ejecuta únicamente los 5 recorridos críticos. El wrapper configura una URL sintética para la API simulada si no existe EXPO_PUBLIC_API_URL; no requiere backend real.
- `pnpm test:dev`: smoke de Metro separado; no sustituye la exportación web ni Android.
- `pnpm ai:validate` y `pnpm ai:test`: verificar contratos del catálogo cuando se modifiquen instrucciones.

Registrar command, status (pass/fail/not_run) y evidence. No afirmar Android físico cuando solo se generó bundle o se verificó viewport móvil web. Si falta un entorno, indicar el límite real en el PR. Las pruebas de compartir archivo en dispositivo quedan pendientes cuando no hay Android disponible.


v0.7: la recuperación de cola se prueba en integración PostgreSQL con reloj controlado: espera entre intentos, límite, lease interrumpido, dueño obsoleto, reencolado concurrente y un único movimiento. Se detiene el worker de smoke antes de esa prueba aislada para evitar consumidores ajenos al escenario. El tercer recorrido Playwright existente añade solo la acción crítica de reintento manual; siguen siendo 9 unitarias CORE y 3 recorridos.


v0.8 añade un único recorrido crítico de acceso personal (credencial rechazada/aceptada, ausencia de persistencia web, cambio que termina sesión y logout). La integración PostgreSQL prueba singleton concurrente, bootstrap desactivado, hashes, expiración, otras sesiones y límites. La prueba de transporte valida rechazo HTTP en production y confianza de encabezados solo por proxy loopback explícito, sin afirmar TLS real. Unitarias CORE: 9. No se añade una matriz de formularios/errores en UI.


v0.9 extiende el mismo recorrido de acceso (siguen siendo 4 recorridos Playwright y 9 unitarias CORE): códigos fuera de web storage, ocultación, confirmación explícita de limpieza y recuperación seguida de login. Integración PostgreSQL cubre hashes/rotación/expiración, recuperación concurrente de un uso, revocación global, preview de IDs exactos, reautenticación, confirmación, rechazo de reutilización y conservación de movimientos/trabajos activos/avisos posteriores. No se añade matriz de pantallas ni tests unitarios por componente. La evidencia de CI se registra en PR #6; Android físico sigue pendiente.


v0.10: se conservan 9 casos unitarios agrupados; precisión/saldos incluyen signo de deuda y traslado conservado. Se agrega solo un quinto recorrido Playwright para el nuevo riesgo financiero: crear cuentas de pago/deuda, pagar tarjeta sin duplicar gasto, comparar/confirmar conciliación y recuperar presupuesto del servidor tras recarga. No se recorren CRUD completo de cuentas, tipos de crédito ni matrices de formularios. PostgreSQL verifica monedas, transferencias idempotentes concurrentes/clave reutilizada, replay tras eliminación, saldo/deuda, filtro origen/destino, preview obsoleta, confirmación concurrente, bloqueo de historia/archivo y presupuestos concurrentes/monedas/tombstone. La ampliación se justifica por riesgo de doble contabilización y pérdida de datos, no por cobertura de pantallas.

El smoke PostgreSQL verifica la retención automática junto al escenario existente de recuperación y retención. El ensayo de administración respalda el estado sintético, rechaza una base ocupada y un archivo modificado, restaura en una base vacía y verifica datos antes de ensayar su borrado. Los recorridos Playwright siguen centrados en el producto.
