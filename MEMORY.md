# FlowSaldo — memoria del proyecto

Última actualización: 2026-11-10. Versión del proyecto y app 0.10.0.

## Objetivo

App Android de finanzas personales a partir de notificaciones bancarias por correo. La versión web permite desarrollar y explorar la interfaz en PC. El proyecto está en fase de prototipo personal con datos sintéticos.

## Arquitectura y herramientas

Monorepo pnpm: apps/mobile (Expo, React Native, React Query), apps/api (Express, Zod, CORS), apps/worker (cola PostgreSQL), packages/domain (reglas puras TypeScript), packages/database (Prisma 7 y PostgreSQL). Node 24 LTS. Docker Compose opcional si PostgreSQL ya está instalado. No microservicios ni agentes en runtime.

## Comandos desde la raíz

- pnpm install --frozen-lockfile: instalar con lockfile.
- pnpm start: abrir servidor para Expo Go; escanear QR desde Android.
- pnpm web: abrir en navegador de la PC.
- pnpm android: abrir en emulador Android ya configurado.
- pnpm dev:api / pnpm dev:worker: servicios locales, con .env configurado.
- pnpm db:generate / db:migrate / db:seed: preparar PostgreSQL.
- pnpm check: lint, tipos y pruebas de dominio.

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

No hay OAuth Gmail/Outlook, parsers bancarios reales ni despliegue de producción verificado; sí hay cuenta personal y sesiones. No conectar información bancaria real. Los listados de compatibilidad conservan 200/100 filas; la app utiliza los endpoints paginados y el resumen mensual completo. Los presupuestos API se guardan en servidor con versión. Cuentas/deuda y conciliación manual disponibles; devoluciones e intereses/cuotas automáticos no implementados. Restablecer demo no borra PostgreSQL.

La exportación nativa genera un archivo CSV en caché y abre el menú de compartir; su recepción en otra app requiere Android físico. Confirmar comportamiento en Android físico y generar APK en EAS sigue pendiente.

## Verificación

Validación histórica v0.3 (antes de migrar a pnpm): npm run check aprobado (14 pruebas), dependencias Expo compatibles, bundles web/Android exportados y flujo Playwright aprobado a 1440 y 390 px. El flujo cubre crear/editar/eliminar, cancelación, persistencia tras recarga, presupuesto, mes/moneda, descarga CSV, confirmación/descarte de revisiones y navegación Conexiones. La prueba adicional de Metro dev pasó con bundle HTTP 200 y carga en navegador. No se probó en Android físico. CI incluye PostgreSQL y smoke de API/worker (autorización, validación, persistencia, idempotencia, REVIEW, filtros, CORS y CRUD). Registrar el resultado concreto en el PR; no dar por aprobado un paso pendiente.

## Siguiente fase

Identidad de usuario, HTTPS y política de datos; elegir proveedor de correo y un banco, reunir muestras anonimizadas y desarrollar OAuth y parser versionado. Añadir paginación y conciliación antes de reportes con datos reales.

## Arranque web y 500 reportado

Un 500 en index.ts.bundle es de Metro. Con instalación limpia la URL dev reportada respondió 200; falta el cuerpo del error original para confirmar su causa. scripts/expo.mjs ejecuta Expo desde apps/mobile, comprueba dependencias web y limpia caché. scripts/dev-smoke.mjs verifica la URL exacta y carga la app en navegador. CI lo ejecuta en Windows y Linux. No afirmar que se identificó una causa sin evidencia.

## Datos y migración v0.3

Se conserva la clave AsyncStorage v2. Se inicializan revisiones sintéticas si el registro v2 no las contiene. Migración aditiva agrega DISMISSED. Los pendientes no afectan totales hasta confirmación. No hay confirmación automática ni IA. Confirmación manual usa /imports/:id/resolve; descarte usa /dismiss; detalle autorizado /imports/:id devuelve cuerpo.

## Infraestructura IA v0.4

Coordinación de desarrollo en ai/, sin proveedor fijo. Perfiles: orquestador, arquitectura, frontend, backend, datos, ingesta, QA, seguridad, revisor y documentación. CLI genera planes y contexto y valida contratos; no ejecuta modelos ni delega automáticamente. Los permisos, límites y concurrencia deben aplicarse en el host. No se añade IA financiera a la app, que mantiene funciones v0.3. Instrucciones comunes AGENTS.md más instrucciones de área; políticas en ai/policies.md, verificación en TESTING.md.

Validación local de infraestructura v0.4: catálogo de diez perfiles y ejemplos de tarea/entrega válidos; nueve pruebas del planificador/contratos aprobadas; generación de plan y paquete frontend y validación de entrega blocked comprobadas. npm run check pasó entonces (lint, tipos y 14 pruebas de dominio). Estas comprobaciones no son una evaluación de modelos ni de ejecución multiagente real.

## v0.5

Migración a pnpm 10.34.7: workspace:* internos, pnpm-workspace.yaml con nodeLinker hoisted y builds permitidos explícitamente, lockfile pnpm, scripts/CI/documentación actualizados. La instalación se valida con --frozen-lockfile. Node 24.

Inicio de sesión y registro son vistas previas no funcionales: botones de envío deshabilitados, credenciales no enviadas ni persistidas, acceso a producto por Explorar demostración. Configuración desde encabezado: preferencias locales de moneda y ocultación visual de importes, más opciones futuras de cuenta deshabilitadas. Preferencias se guardan separadas de movimientos demo; ocultación no elimina datos de exportaciones ni formularios.

Revisión lingüística language-editor y guardián export-guardian agregados al catálogo y plan. countLabel cubre 0/1/N y pendingMailMessage la concordancia. text:check detecta patrones conocidos, no toda la gramática. CSV web tiene nombre FlowSaldo y encabezados con mayúscula. Guardián CLI valida nombre y estructura de CSV/.xlsx, incluidas columnas separadas; para otros formatos solo nombre y existencia. No se incorpora exportador Excel a la UI.

Validación local v0.5: instalación pnpm congelada aprobada, Prisma generado, lint/tipos, 16 pruebas de dominio, 3 de exportación con CSV/.xlsx reales y 10 de coordinación aprobadas. Flujo web aprobado para acceso/registro sin POST, configuración persistente, pluralización singular, nombre/columnas del CSV, CRUD y revisión. Metro dev respondió 200 y se generó bundle Android; no se probó en Android físico.


## v0.6 — Entrega 1 (2026-11-10)

Historial paginado con cursor compuesto fecha/ID, resumen mensual completo agregado en PostgreSQL, CSV con todos los resultados filtrados y revisiones por estado/fecha de recepción. Se preservan rutas legacy sin page=true; contratos en docs/api.md. Totales/categorías/flujo semanal independientes de páginas cargadas. Snapshot RepeatableRead por respuesta, sin snapshot entre páginas: cambios concurrentes requieren actualizar. CSV se genera desde una consulta completa en memoria. No hay migración ni cambios de autenticación; la clave local v2 se conserva. Revisiones demo nuevas tienen createdAt; antiguas sin fecha no se inventan ni eliminan, y quedan fuera de filtros de fecha.

Entrega 1 del lote: las próximas entregas abarcan categorías, presupuestos por categoría, registro rápido, comparativas, recurrencias y archivo CSV nativo. La versión de paquete sigue 0.5.0 hasta completar el lote. Registrar evidencia real de validación en el PR.


## v0.6 — Entrega 2 (2026-11-10)

Catálogo Category en PostgreSQL y demo, con IDs estables, nombre normalizado, archivo/reactivación y Sin categorizar protegida. Movement.category queda como etiqueta histórica y categoryId vincula catálogo/presupuestos/filtros. Renombrar no reescribe historia. La migración aditiva 20261110000000_categories inicializa catálogo y backfill; nuevos movimientos manuales y worker asocian ID. Asignación transaccional bloquea la categoría; archivo impide nuevas asignaciones, pero permite conservarla en una edición. Duplicación es asignación nueva.

Presupuestos por categoría locales al dispositivo, modo/mes/moneda/ID; gasto completo por ID desde summary.categoryTotals en API. Umbrales 80/100 exactos con porcentaje redondeado. Archivo conserva límites, con opción de retirarlos. Sin sincronización multiusuario. Demo mantiene clave v2, migra categorías sin cambiar snapshots ni importes. Registro rápido: fecha actual local si es mes vigente, primer día si es otro mes, calendario, recientes a partir del historial cargado y duplicación como borrador explícito.

Pruebas añadidas de CORE: actualización local idempotente, archivo/renombrado con historia, umbrales, fechas; integración de migración sobre registros previos, catálogo API y revisión con categoría archivada; Playwright de actualización demo, presupuestos aislados/persistidos, calendario y duplicación. Evidencia concreta de ejecución y CI en PR #6. Próxima entrega: comparativas mensuales, recurrencias, trazabilidad revisión → movimiento y archivo CSV nativo.


## v0.6 — Entrega 3 y política QA (2026-11-10)

Lote completado: comparación mensual por moneda con base cero explícita; plantillas mensuales con confirmación manual, pausa/reactivación, anchorDay estable y ledger separado; trazabilidad revisión → movimiento; CSV nativo adjunto mediante módulos Expo compatibles con el SDK instalado. Root/mobile/app version 0.6.0. Migración aditiva 20261110010000_recurring, sin reset. Demo agrega recurring/receipts vacíos conservando clave, datos y presupuestos. Confirmación usa día UTC; no procesa futuros, pausa conserva atrasos y editar no altera calendario. version evita confirmar datos obsoletos. Un vencimiento confirmado no se puede registrar otra vez aunque su movimiento sea eliminado. Demo bloquea por vencimiento en una instancia; no garantiza concurrencia entre pestañas.

CSV nativo: archivo temporal con BOM, MIME y nombre correctos; se retiene en caché del SO para permitir que la app receptora lo lea. Bundle Android no equivale a validación de compartir en dispositivo. No se añaden OAuth ni datos reales.

Instrucción explícita del usuario: unitarias y Playwright solo relevantes/CORE. Se sustituyen 20 unitarias dispersas por 9 casos financieros agrupados y los recorridos web extensos por 3 recorridos críticos independientes. Sin matrices de pantallas/preferencias/calendario/CRUD secundario en UI; combinaciones transaccionales y autorización viven en integración API. Smoke Metro solo arranque/bundle. Regla permanente en AGENTS.md, TESTING.md y perfil QA/catálogo. Nuevos tests deben justificar riesgo CORE o regresión concreta, sin duplicación por capa.

Evidencia de instalación, Prisma, checks, integración y CI del commit final en PR #6. Validación en Android físico/APK sigue pendiente.


## v0.7 — Fiabilidad de importaciones (2026-11-10)

Siguiente lote elegido del roadmap después de completar v0.6: robustecer worker/cola sintética antes de correo real. PROCESSING/FAILED, intentos durables y lease de 30 s con token de propietario; cinco intentos por ciclo y backoff exponencial. Fallo de DB aplica espera en memoria hasta 30 s, sin fingir persistencia durante la caída. Marcar resultado exige token actual; el movimiento y estado terminal son transaccionales. Formato desconocido -> REVIEW sin reintentar ni contabilizar. Códigos públicos resumidos, nunca excepción SQL ni lockToken en API.

POST /imports/:id/retry solo FAILED sin movimiento, bajo bloqueo de fila; attempts vuelve a cero, manualRetries sube y el ciclo continúa en PENDING. No reabre PARSED al borrar su movimiento. GET /imports/stats da instantánea real, sin afirmar conectividad del worker. UI en Conexiones y filtro Con error con confirmación de reintento; polling solo en secciones relevantes. Migración aditiva 20261110020000_import_recovery; detener API/worker, aplicar Prisma y reiniciar versión nueva juntos. No cambia claves locales ni datos demo.

Regla de pruebas conservada: 9 casos CORE, 3 recorridos Playwright (se extiende el recorrido API crítico, sin nueva matriz). Integración PostgreSQL cubre backoff, intentos/reserva durables, recuperación de proceso interrumpido, propietario obsoleto, agotamiento y reintento manual concurrente. Evidencia y CI en PR #6. Identidad/OAuth, política de retención, conciliación y Android físico siguen pendientes.


## v0.8 — Acceso personal (2026-11-10)

Cuenta única AppOwner id=1 con constraint; setup requiere DEV_API_TOKEN, conserva datos y desactiva el acceso legacy con ese token al crear owner. Inicio/logout, 24 h de sesión, otras sesiones, cambio de contraseña y revocación global. Scrypt-v1 (N2^17,r8,p1, sal16, clave64), tokens aleatorios256bits guardados comoSHA256. Throttle persistido por IP/acción; dos hashes concurrentes máximo. Password change y login se serializan en owner para impedir emitir sesiones con contraseña obsoleta. No hay multiusuario, recuperación por correo ni eliminación de cuenta.

Cliente AuthScreen funcional: web token en memoria; nativo SecureStore ligado a API URL con validación previa a restaurar. Logout/401 elimina credencial y caché, sin simular revocación remota si falla red. HTTP público bloqueado; production API requiere HTTPS, con trust proxy solo loopback explícito. No se despliega TLS ni se certifican datos reales. Migración personal_access aditiva, sin reset. La demo y presupuestos locales permanecen separados y sin cifrar.

QA sigue acotado: 9 unitarias CORE, 4 recorridos web al añadir solo el flujo crítico de acceso/cambio/cierre. Integración valida singleton concurrente, bloqueo bootstrap después de setup, hashes/sesiones, expiración/revocación, throttle, límite de URL/proxy. Android físico/SecureStore y recuperación de contraseña siguen pendientes. Evidencia de ejecución y CI en PR #6.


## v0.9 — Recuperación y limpieza manual (2026-11-10)

Siguiente lote del roadmap: recuperación mediante cinco códigos offline de 192 bits, hashes SHA256, 90 días, generación/revocación con reautenticación. Consumo concurrente serializado en AppOwner; recuperar invalida lote y sesiones, cambiar contraseña invalida códigos. Texto en memoria cliente con ocultación a cinco minutos; no envío de correo ni bypass bootstrap.

Retención manual de cuerpos REVIEW/FAILED antiguos sin movimiento, 7–365 días, hasta 1000 por lote. Preview guarda IDs/cutoff, un uso/10min; apply exige contraseña y literal, revalida elegibilidad y preserva movimientos/cola activa/avisos posteriores. Limpia credenciales caducadas y registra cantidades sin cuerpos. Migración recovery_retention aditiva. No es borrado completo de cuenta ni retención automática.

Versiones root/mobile/app 0.9.0. Pruebas acotadas: mismas 9 unitarias CORE y 4 recorridos web; ampliar solo acceso crítico y smoke API para riesgos de recuperación/pérdida de datos. Evidencia de ejecución en PR #6. Plan original de ocho features implementado; validación física Android/SecureStore/CSV/APK, TLS real, proveedor/banco/OAuth, conector/parsers reales, deduplicación semántica, cuentas/deudas/conciliación y sincronización de presupuestos siguen pendientes. docs/roadmap.md es estado actual; notas anteriores son historial.


## v0.10 — Punto #4 del roadmap (2026-11-10)

Cuentas financieras en API: BANK/CASH/CREDIT_CARD/LOAN, moneda explícita y saldo inicial fijo. Tarjeta/préstamo inicial <=0; saldos/deuda y crédito disponible calculados, sin intereses/cuotas automáticas. Movimientos previos siguen sin cuenta; asignación manual, transferencias misma moneda origen/destino. Pagos de principal no duplican gastos. FinanceLock serializa mutaciones vinculadas y conciliación, revision invalida previews, corte UTC confirmado protege altas/ediciones/desvinculaciones/borrados históricos. No reapertura de períodos ni ajustes automáticos. IDs de recibo manual persisten al eliminar movimiento para impedir replay. Filtro de cuenta incluye destino y CSV completo.

Presupuestos API por mes/moneda ahora en PostgreSQL, versión optimista y tombstone al quitar límites; conflicto exige refetch/revisión. Límites locales anteriores conservados y copia explícita de general/categorías activas solo en período servidor vacío. Demo sigue local, sin añadir cuentas ficticias ni cifras bancarias. Migración financial_accounts aditiva; detener servicios, generar/migrar y reiniciar.

Versiones 0.10.0. Pruebas: siguen 9 casos CORE ampliando precisión/saldos; un quinto recorrido crítico Playwright se justifica por nuevo riesgo de pago/conciliación/presupuesto persistido. Concurrencia, moneda, recibos borrados, períodos protegidos y versiones viven en integración PostgreSQL. Validación/CI concretos en PR #6. Usuario autorizó puntos #4 y #5 en mismo PR, comenzar por #4; #5 aún pendiente: borrado completo, retención automática y respaldos/restauración. Android físico y correo/TLS reales siguen pendientes.

### Punto #5 — Mantenimiento de datos (2026-11-11)

Retención automática opcional con AUTO_RETENTION_DAYS, 7–365, lote de 1000 cada hora por worker y bloqueo para procesar filas elegibles sin duplicar la limpieza. Cubre REVIEW/FAILED antiguos sin movimiento, conserva la clave externa y registra conteos. Operaciones de borrado y respaldo/restauración son CLI de operador. El borrado exige base exacta y servicios detenidos; conserva migraciones y repone categorías base. El respaldo excluye sesiones, códigos, limitadores y vistas previas. Restauración de copia confiable en base vacía verifica SHA-256 y usa transacción. CI ensaya contra una base restaurada aislada.

### Piloto Android y HTTPS

API con TLS directo opcional mediante par PEM, configuración proxy limitada a loopback, integración con certificado temporal y sesiones activa/revocada. Perfil EAS APK preview con entorno explícito y guía de despliegue y pruebas físicas. El dominio/certificado público, la firma EAS y el dispositivo se validan en el entorno del piloto.

### Guías de arranque y prompts

El README enlaza a docs/setup.md para ejecutar desde un clon y a docs/pilot.md para generar el APK. Perfiles, flujos y prompt inicial usan seis secciones comunes. Los comandos de planificación, contexto y entrega conservan sus contratos JSON.

## Arranque conjunto, acceso y MVC

`pnpm dev` inicia API, worker y web. `pnpm db:setup` genera Prisma y aplica migraciones en la base configurada. El registro conserva la cuenta personal única y su token de configuración. Las credenciales públicas de prueba solo abren los datos ficticios del dispositivo. El backend organiza los controladores, modelos y vistas JSON según MVC.

## Períodos y tasas de referencia

Inicio y Análisis comparten fecha de referencia. El resumen y los presupuestos siguen siendo mensuales; el flujo de siete días puede cruzar meses. Tasas usa Frankfurter v2 directamente desde el cliente, con fecha efectiva, consulta histórica y conversión estimada de USD/EUR a DOP. EUR se limita a Tasas. El módulo vive en apps/mobile/src/Servicios y no cambia importes registrados.
