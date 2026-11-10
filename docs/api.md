# Contrato API — historial completo (v0.6, entrega 1)

Base local: http://127.0.0.1:3000. Todo salvo health requiere `Authorization: Bearer <DEV_API_TOKEN>`. Error de autorización: 401; validación: 400; fallo inesperado: 500 sin detalle sensible. CORS admite WEB_ORIGINS, por defecto http://localhost:8081 y http://127.0.0.1:8081. La preflight no requiere token; las operaciones sí.

| Método | Ruta | Resultado |
|---|---|---|
| GET | /health | Estado del proceso (no comprueba PostgreSQL) |
| GET | /movements | Últimos 200 movimientos, fecha descendente; filtros opcionales month=AAAA-MM y currency=DOP o USD |
| POST | /movements | Crear movimiento manual, 201 |
| PATCH | /movements/:id | Sustituir los campos editables con el mismo cuerpo de creación; 404 si no existe |
| DELETE | /movements/:id | Eliminar, 204; 404 si no existe |
| GET | /summary?currency=DOP | Totales de todos los movimientos de esa moneda |
| POST | /imports | Encolar mensaje o devolver existente, 202 |
| GET | /imports/:id | Detalle y cuerpo sintético de una importación, 404 si no existe |
| POST | /imports/:id/resolve | Cuerpo igual a POST /movements, confirmación manual, 201; 409 si ya se procesó |
| POST | /imports/:id/dismiss | Descarta REVIEW sin contabilizar, 204; 409 si no está en revisión |
| GET | /imports | Últimas 100 importaciones, sin cuerpos |

POST /movements:

```json
{"amountMinor":125050,"currency":"DOP","type":"EXPENSE","description":"Compra de ejemplo","category":"Alimentación","occurredAt":"2026-10-22T12:00:00.000Z"}
```

Monedas: DOP, USD. Tipos: INCOME, EXPENSE, TRANSFER. amountMinor entero positivo hasta 2147483647. Fecha ISO UTC con Z. Categoría opcional, por defecto Sin categorizar.

POST /imports:

```json
{"externalId":"demo-001","body":"FLOWSALDO-DEMO|EXPENSE|DOP|1250.50|2026-10-22|Compra de ejemplo"}
```

PATCH permite editar categoría y demás campos del movimiento. DELETE elimina el movimiento; no borra el registro de importación ni lo vuelve a encolar. POST /imports/:id/resolve permite corregir y confirmar REVIEW en una transacción con bloqueo de fila. Dos confirmaciones concurrentes generan exactamente un movimiento (201 y 409); no se pueden confirmar descartados. Al resolver/descartar se vacía el cuerpo. No hay endpoints aún para exportar CSV, autenticación OAuth o presupuestos. Exportación y presupuestos se resuelven en el cliente en esta versión. Se añadirá OpenAPI junto con esos contratos antes de una integración externa.


## Historial paginado y resumen mensual

La app utiliza `GET /movements?page=true&month=AAAA-MM&currency=DOP` y `GET /imports?page=true`. Para compatibilidad, omitir `page` conserva los listados antiguos limitados a 200/100 filas; no usarlos para totales completos.

Ambas rutas paginadas aceptan `limit` (1–200, por defecto 50) y `cursor` opaco. Respuesta: `{items,total,nextCursor}`; `nextCursor: null` indica fin. `total` cuenta todos los resultados filtrados, no solo la página. Orden estable por fecha descendente e ID ascendente; el cursor contiene la fecha e ID, por lo que borrar la fila de anclaje no impide continuar. No modificar el cursor y reiniciar al cambiar filtros. Cada respuesta usa una instantánea consistente; distintas páginas no congelan el historial ante ediciones concurrentes. Actualizar reinicia/revalida la consulta; no se promete una instantánea entre páginas.

Movimientos admite `month`, `currency`, `type=INCOME|EXPENSE|TRANSFER` y `search` (hasta 100 caracteres, texto literal sin distinguir mayúsculas, sobre descripción/categoría). Los mismos filtros se aplican a `GET /movements/export`, que exige mes y moneda y devuelve un CSV UTF-8 con BOM y `Content-Disposition: attachment; filename="FlowSaldo-AAAA-MM.csv"`. Incluye el conjunto completo en una única consulta, aunque no se hayan cargado más páginas. Una descarga fallida no entrega un CSV parcial. La exportación carga el resultado en memoria: queda pendiente streaming para volúmenes muy grandes.

`GET /summary?month=AAAA-MM&currency=DOP` calcula en PostgreSQL ingresos, gastos, diferencia, cantidad total, gastos por categoría y siete días de flujo del mes. Campos: `currency,month,scope:"month",incomeMinor,expenseMinor,differenceMinor,total,categories:[{category,amountMinor}],days:[{day,incomeMinor,expenseMinor,netMinor}]`. Usa una transacción RepeatableRead. Los últimos siete días terminan hoy si se consulta el mes UTC actual, o al final del mes consultado; no se incluyen movimientos de otro mes. Transferencias cuentan en cantidad total, pero no en ingresos/gastos. No confundir diferencia con saldo bancario. Sin mes se mantiene el resumen histórico anterior.

Importaciones admite `status=PENDING|REVIEW|PARSED|DISMISSED`, `from=AAAA-MM-DD` y `to=AAAA-MM-DD`: recepción inclusiva por días UTC. Fecha inválida o rango invertido devuelve 400. Añade `pendingTotal` (todas las revisiones pendientes, independiente del filtro) y excluye cuerpos. El historial confirmado/descartado es de consulta; únicamente REVIEW permite confirmar o descartar. Cursores, límites y filtros inválidos devuelven 400.

No requiere migraciones nuevas. Mantiene autorización Bearer, datos sintéticos e idempotencia de confirmación/worker.
