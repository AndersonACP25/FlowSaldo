# Contrato API v0.2

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

PATCH permite editar categoría y demás campos del movimiento. DELETE elimina el movimiento; no borra el registro de importación ni lo vuelve a encolar. No hay endpoints aún para corregir REVIEW, exportar CSV, autenticación OAuth o presupuestos. Exportación y presupuestos se resuelven en el cliente en esta versión. Se añadirá OpenAPI junto con esos contratos antes de una integración externa.
