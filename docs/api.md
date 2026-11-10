# Contrato API — FlowSaldo v0.8

Base local: http://127.0.0.1:3000. Salvo health/preflight y las rutas públicas acotadas de acceso, se requiere Authorization Bearer. Antes de configurar la cuenta se admite DEV_API_TOKEN; después solo sesiones personales. Error de autorización: 401; validación: 400; fallo inesperado: 500 sin detalle sensible. CORS admite WEB_ORIGINS, por defecto http://localhost:8081 y http://127.0.0.1:8081. La preflight no requiere token; las operaciones sí.

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


## v0.7 — Cola recuperable y reintentos

Migración aditiva `20261110020000_import_recovery`: agrega PROCESSING y FAILED al enum y metadatos de intentos/bloqueo. Conserva filas, cuerpos pendientes e IDs de importación/movimientos; los contadores de filas anteriores comienzan en cero, sin reconstruir intentos históricos. Detener API/worker anteriores, aplicar Prisma y arrancar los nuevos juntos.

El worker reclama PENDING solo cuando nextAttemptAt ha llegado, o PROCESSING con lockedUntil vencido. Usa FOR UPDATE SKIP LOCKED, incrementa attempts de forma durable y asigna lockToken/lease de 30 segundos antes de procesar. Finalizar exige conservar el token bajo bloqueo de fila; un propietario antiguo no puede finalizar ni modificar un trabajo recuperado. Crear movimiento y cambiar estado siguen en una sola transacción con importId único.

Hasta 5 intentos por ciclo. Fallos recuperables vuelven a PENDING con esperas de 2, 4, 8 y 16 segundos; después pasan a FAILED. Un fallo de categoría del sistema inexistente pasa directamente a FAILED. Si el proceso se interrumpe durante el quinto intento, el siguiente worker marca FAILED al recuperar la reserva. Formato desconocido/monto fuera de rango sigue yendo a REVIEW inmediatamente, sin reintentos automáticos ni contabilización.

Si PostgreSQL está caído no se pueden guardar intentos fallidos: el proceso aplica espera en memoria con máximo de 30 segundos, y una reserva ya persistida se recupera al expirar cuando la base vuelve. attempts cuenta reservas durables de procesamiento, no cada intento de reconexión.

| Método | Ruta | Resultado |
|---|---|---|
| GET | /imports/stats | counts por estado, scheduledRetries, expiredLeases, nextRetryAt y lastProcessedAt; instantánea RepeatableRead autorizada |
| POST | /imports/:id/retry | Solo FAILED sin movimiento generado: reencola, reinicia attempts del ciclo, incrementa manualRetries y devuelve 202; concurrente/no elegible 409; inexistente 404 |

El listado paginado permite PROCESSING y FAILED. Listados y detalle exponen attempts, manualRetries, nextAttemptAt, lastAttemptAt, lastErrorCode, processedAt y lockedUntil. Nunca devuelven lockToken ni excepciones/SQL/tokens internos. Los códigos públicos son PROCESSING_FAILED, CATEGORY_UNAVAILABLE y LEASE_EXPIRED; son diagnósticos resumidos, no mensajes originales de excepción. Los listados siguen excluyendo cuerpos. FAILED conserva su cuerpo sintético para poder reintentar; PARSED y DISMISSED siguen vaciándolo.

Reencolar requiere acción explícita; repetir POST /imports con el mismo externalId conserva su estado y no inicia otro ciclo. Una importación ya PARSED no puede reintentarse aunque se elimine su movimiento. La confirmación manual sigue limitada a REVIEW y conserva 201/409.

Conexiones muestra estado de importaciones sin afirmar que el worker esté conectado. Actualización cada 5 segundos solo al consultar Conexiones; Por revisar actualiza su listado cada 5 segundos mientras esa sección está abierta. Los tiempos se muestran en UTC. No se añade OAuth, ingesta de correo real ni actividad simulada.


## v0.8 — Cuenta personal y sesiones

Aplicar `20261110030000_personal_access`: crea AppOwner singleton (id=1), AccessSession y AuthThrottle. No asigna un usuario a filas individuales ni convierte el proyecto en multiusuario: toda la instalación pertenece a una sola cuenta. No borra, reinicia ni cambia los movimientos, categorías, importaciones o presupuestos anteriores. La cuenta inicial se crea explícitamente y queda asociada a esos datos.

| Método | Ruta | Autorización / resultado |
|---|---|---|
| GET | /auth/status | Público, solo configured boolean; no devuelve identidad |
| POST | /auth/setup | Authorization Bearer DEV_API_TOKEN, cuerpo name/email/password; 201 con owner; 409 si ya existe; singleton protegido también contra creación concurrente |
| POST | /auth/login | Público, email/password; 200 con token, expiresAt, sessionId y owner; error genérico 401; rate limit 429 |
| GET | /auth/me | Sesión vigente; owner, expiresAt, sessionId |
| POST | /auth/logout | Sesión vigente; revoca la actual, 204 |
| GET | /auth/sessions | Sesión vigente; solo id/createdAt/expiresAt/current, nunca token ni hash |
| POST | /auth/sessions/revoke-others | Sesión vigente; revoca otras, devuelve revoked |
| POST | /auth/password | Sesión vigente, currentPassword/newPassword; 204 y revocación de todas las sesiones |

La nueva contraseña tiene 15–128 caracteres, no se recorta y debe diferir de la actual. El correo se recorta/normaliza a minúsculas; nombre 1–60. Scrypt y tokens opacos según SECURITY.md. Sesión fija de 24 h, sin refresh automático. Máximo diez activas: una sesión nueva desplaza la más antigua. Sesiones revocadas/expiradas se eliminan al emitir otra. Password change serializa con login mediante bloqueo de AppOwner.

El token inicial solo autoriza datos mientras AppOwner no existe. Después devuelve 401, incluso si se mantiene una conexión de desarrollo anterior. No crea una segunda cuenta ni permite recuperar una contraseña olvidada. /auth/setup no inicia sesión automáticamente: el cliente pide entrar con la cuenta recién creada. /auth/me y operaciones de cuenta no admiten el token inicial, ni siquiera antes de setup.

Throttling por IP/acción persistido, 15 min: setup/cambio 5 solicitudes, login 10; inválidas también cuentan. 429 incluye Retry-After. Se evita registrar contraseñas, hashes o sesiones en logs. La respuesta de error no distingue cuenta inexistente/contraseña equivocada. Validación 400, credencial inválida 401, instalación ya configurada o cambio concurrente 409, límite 429, cómputo de hash ocupado 503.

NODE_ENV=production exige req.secure en acceso/datos y no acepta X-Forwarded-Proto por defecto. Un proxy TLS local requiere TRUST_PROXY_LOOPBACK=1 y configuración que sobrescriba encabezados; este PR no despliega certificados ni un proxy. HTTP privado de desarrollo sigue solo para datos ficticios.


## v0.9 — Recuperación y retención

Migración aditiva `20261110040000_recovery_retention`: RecoveryCode, CleanupPreview y DataCleanup; sin reset ni cambio de datos financieros.

| Método | Ruta | Contrato |
|---|---|---|
| POST | /auth/recover | Público: email, code (fr_ + 32 caracteres base64url), newPassword 15–128; 204, código/correo inválido 401, límite 429. Consume lote completo y revoca todas las sesiones; no inicia sesión automáticamente |
| GET | /auth/recovery-codes | Sesión: remaining y expiresAt, nunca códigos/hashes |
| POST | /auth/recovery-codes | Sesión + currentPassword: 201 con codes y expiresAt; cinco códigos nuevos, reemplaza lote anterior, vencimiento 90 días, texto visible solo aquí |
| POST | /auth/recovery-codes/revoke | Sesión + currentPassword: 204, invalida lote completo |
| POST | /auth/data/retention/preview | Sesión + olderThanDays entero 7–365: previewId, cutoff, expiresAt, reviewBodies, failedBodies, totalEligible, hasMore, lastCleanup |
| POST | /auth/data/retention/apply | Sesión + previewId, currentPassword, confirmation literal ELIMINAR CONTENIDO; 200 con id/cutoff/createdAt y cantidades reviewBodies/failedBodies/accessRecords |

Generar/revocar comparten cinco intentos por IP/15 min. Recuperar y aplicar limpieza tienen cada uno cinco intentos por IP/15 min; también cuentan entradas inválidas. Cambiar contraseña ahora invalida también códigos. Contraseña incorrecta 401, validación 400, vista previa vencida/sustituida/consumida o contraseña cambiada concurrentemente 409, hash ocupado 503. /auth/recover es excepción pública acotada de autenticación, con la misma política de transporte HTTPS y no-store.

Preview guarda hasta 1000 IDs elegibles más antiguos por createdAt/id, cutoff fijo y caducidad diez minutos; solo una preview por propietario. Apply consume exactamente ese conjunto, revalida REVIEW/FAILED, cuerpo no vacío, fecha y ausencia de movimiento, y marca DISMISSED vaciando body. Conservará avisos nuevos, confirmados o reencolados en estado activo. Las cantidades finales pueden disminuir por acciones concurrentes. No reintenta un aviso descartado. Limpia sesiones revocadas/vencidas, códigos vencidos/usados y throttles anteriores a un día; no elimina la sesión vigente. Se registra auditoría de cantidades, sin texto original. No elimina datos financieros/cuenta ni programa tareas automáticas.
