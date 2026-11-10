# Contrato API — FlowSaldo v0.6

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

PATCH permite editar categoría y demás campos del movimiento. DELETE elimina el movimiento; no borra el registro de importación ni lo vuelve a encolar. POST /imports/:id/resolve permite corregir y confirmar REVIEW en una transacción con bloqueo de fila. Dos confirmaciones concurrentes generan exactamente un movimiento (201 y 409); no se pueden confirmar descartados. Al resolver/descartar se vacía el cuerpo. La exportación completa está documentada abajo; los presupuestos siguen locales y OAuth sigue pendiente. Se añadirá OpenAPI junto con esos contratos antes de una integración externa.


## Historial paginado y resumen mensual

La app utiliza `GET /movements?page=true&month=AAAA-MM&currency=DOP` y `GET /imports?page=true`. Para compatibilidad, omitir `page` conserva los listados antiguos limitados a 200/100 filas; no usarlos para totales completos.

Ambas rutas paginadas aceptan `limit` (1–200, por defecto 50) y `cursor` opaco. Respuesta: `{items,total,nextCursor}`; `nextCursor: null` indica fin. `total` cuenta todos los resultados filtrados, no solo la página. Orden estable por fecha descendente e ID ascendente; el cursor contiene la fecha e ID, por lo que borrar la fila de anclaje no impide continuar. No modificar el cursor y reiniciar al cambiar filtros. Cada respuesta usa una instantánea consistente; distintas páginas no congelan el historial ante ediciones concurrentes. Actualizar reinicia/revalida la consulta; no se promete una instantánea entre páginas.

Movimientos admite `month`, `currency`, `type=INCOME|EXPENSE|TRANSFER` y `search` (hasta 100 caracteres, texto literal sin distinguir mayúsculas, sobre descripción/categoría). Los mismos filtros se aplican a `GET /movements/export`, que exige mes y moneda y devuelve un CSV UTF-8 con BOM y `Content-Disposition: attachment; filename="FlowSaldo-AAAA-MM.csv"`. Incluye el conjunto completo en una única consulta, aunque no se hayan cargado más páginas. Una descarga fallida no entrega un CSV parcial. La exportación carga el resultado en memoria: queda pendiente streaming para volúmenes muy grandes.

`GET /summary?month=AAAA-MM&currency=DOP` calcula en PostgreSQL ingresos, gastos, diferencia, cantidad total, gastos por categoría y siete días de flujo del mes. Campos: `currency,month,scope:"month",incomeMinor,expenseMinor,differenceMinor,total,categories:[{category,amountMinor}],days:[{day,incomeMinor,expenseMinor,netMinor}]`. Usa una transacción RepeatableRead. Los últimos siete días terminan hoy si se consulta el mes UTC actual, o al final del mes consultado; no se incluyen movimientos de otro mes. Transferencias cuentan en cantidad total, pero no en ingresos/gastos. No confundir diferencia con saldo bancario. Sin mes se mantiene el resumen histórico anterior.

Importaciones admite `status=PENDING|REVIEW|PARSED|DISMISSED`, `from=AAAA-MM-DD` y `to=AAAA-MM-DD`: recepción inclusiva por días UTC. Fecha inválida o rango invertido devuelve 400. Añade `pendingTotal` (todas las revisiones pendientes, independiente del filtro) y excluye cuerpos. El historial confirmado/descartado es de consulta; únicamente REVIEW permite confirmar o descartar. Cursores, límites y filtros inválidos devuelven 400.

La entrega 1 no requería migraciones nuevas; la entrega 2 añade el catálogo de categorías descrito a continuación. Mantiene autorización Bearer, datos sintéticos e idempotencia de confirmación/worker.


## Entrega 2 — Categorías administrables

Aplicar `pnpm db:generate` y `pnpm db:migrate` antes de iniciar API/worker nuevos. La migración `20261110000000_categories` crea Category, agrega Movement.categoryId e inicializa las categorías predeterminadas y las existentes. No cambia los importes, etiquetas category, monedas, fechas ni IDs de movimientos. Unifica nombres por mayúsculas/minúsculas y espacios consecutivos. No se borran tablas ni se reinician datos.

| Método | Ruta | Contrato |
|---|---|---|
| GET | /categories | Catálogo completo, activas primero; objetos id, name, normalizedName, archived, system |
| POST | /categories | `{name}`; nombre de 1–60 caracteres tras normalizar espacios; 201; duplicado 409 |
| PATCH | /categories/:id | `{name?,archived?}` con al menos un campo; 200; inexistente 404; categoría del sistema 409 |

Sin categorizar es la categoría protegida del worker: no admite renombrado ni archivo. No hay borrado físico de categorías. Archivar conserva movimientos y presupuestos; se puede reactivar. Renombrar mantiene el identificador y las etiquetas históricas de cada movimiento; las asignaciones nuevas toman el nombre actual.

POST/PATCH /movements y POST /imports/:id/resolve aceptan `categoryId`. Se recomienda enviarlo; sin él se busca `category` por nombre normalizado, por defecto Sin categorizar. Categoría desconocida devuelve 400; archivada, 409. Un movimiento ya asociado puede conservar su categoría archivada al editar otros campos. Duplicarlo es una asignación nueva y exige una categoría activa. Las asignaciones bloquean la fila de categoría dentro de la transacción, coordinándose con archivo/renombrado. Confirmación de revisiones conserva el bloqueo de importación y la idempotencia.

GET /movements?page=true y /movements/export admiten `categoryId`, incluyendo categorías archivadas. El resumen mensual agrega `categoryTotals:[{categoryId,amountMinor}]` para gastos por ID, independiente de páginas y nombres históricos. `categories` conserva el desglose por etiqueta histórica de la entrega anterior. Transferencias e ingresos no consumen presupuestos de gastos.

Los presupuestos general y por categoría siguen locales al dispositivo. Cada límite por categoría se identifica por modo demo/API, mes, moneda e ID de categoría. No se sincronizan ni crean usuarios. Avisos de 80 % y 100 % utilizan el gasto real; el porcentaje mostrado se redondea sin adelantar el aviso. Archivar conserva un presupuesto y permite retirarlo, pero no asignar uno nuevo a esa categoría.


## Entrega 3 — Comparativas, recurrencias y trazabilidad

El resumen mensual agrega `comparison:{previousMonth,income,expense}`, con `{previousMinor,deltaMinor,percentage}` por indicador. Consulta los dos meses en la misma transacción RepeatableRead. Si el mes anterior vale cero, percentage es null cuando el actual es positivo y 0 cuando ambos son cero. Mes/moneda explícitos, sin mezclar transferencias. No compara saldos bancarios.

| Método | Ruta | Contrato |
|---|---|---|
| GET | /recurring | Plantillas mensuales ordenadas por nextDate e ID; incluye version |
| POST | /recurring | description, amountMinor, currency, type, categoryId, startDate=AAAA-MM-DD; categoría opcional como etiqueta; crea plantilla activa, 201, sin contabilizar |
| PATCH | /recurring/:id | Campos editables anteriores excepto startDate, más active; al menos uno, sin propiedades desconocidas; incrementa version. Conserva startDate, nextDate y anchorDay |
| POST | /recurring/:id/confirm | `{scheduledFor:"AAAA-MM-DD",expectedVersion:0}`; 201 con `{movement,nextDate}` o 409 si está pausada, futura, ya registrada, cambiaron sus datos/fecha o la categoría está archivada |
| GET | /movements/:id | Movimiento individual autorizado; 404 si ya no existe |

La plantilla tiene startDate, nextDate, anchorDay y active. Solo se admite periodicidad mensual. El anchorDay se conserva al ajustar meses cortos. No hay scheduler, cargos automáticos, borrado físico de plantillas ni saltos implícitos de vencimientos: pausar/reactivar conserva el próximo pendiente. Cada confirmación usa la fecha del vencimiento a mediodía UTC y el día UTC del servidor como límite. Bloqueo de fila de plantilla, expectedVersion y constraint único (templateId,scheduledFor) evitan duplicados y confirmaciones sobre datos obsoletos. categoryId se valida dentro de esa transacción.

La migración aditiva `20261110010000_recurring` crea RecurringTemplate y RecurringOccurrence, sin modificar movimientos previos. Cada ocurrencia conserva su registro al eliminar el movimiento (movementId pasa a null); la fecha ya confirmada no se vuelve a abrir. En demo se conservan recibos locales y un bloqueo por vencimiento dentro de la instancia de app; no hay sincronización entre pestañas/dispositivos.

GET /imports, el listado paginado y GET /imports/:id incluyen `movement:{id}` o null. Confirmar conserva la relación existente importId; descartar no crea vínculo. Al eliminar un movimiento, el vínculo deja de estar disponible y la importación sigue procesada. Los cuerpos de correo no se agregan a los listados.
