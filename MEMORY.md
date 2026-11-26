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

## Categorías e importación bancaria

Configuración permite eliminar definitivamente categorías sin referencias. Las categorías vinculadas se conservan y pueden archivarse. Alcance bancario: República Dominicana y PayPal. Los retiros sintéticos aprobados en DOP de BHD y Popular generan sugerencias para revisión manual, sin OAuth ni contabilización automática.

## Plan del piloto Gmail

El próximo feature usa un buzón de prueba y sincronización manual. El primer corte prepara OAuth, vuelve observable el estado de conexión y reaprovecha la revisión de retiros BHD/Popular. La ventana inicial propuesta es de siete días.

## Acceso de prueba local y plan de funcionalidades (2026-11-24)

El inicio de sesión permite rellenar las credenciales públicas de la cuenta de prueba. Correo reconocido y contraseña incorrecta se validan localmente. La cuenta abre el modo local en web y Android, con datos separados por instalación. PostgreSQL y el traspaso a la cuenta personal quedan para una fase posterior. El plan vigente prioriza validar la APK, respaldo JSON, importación CSV y recordatorios locales. Gmail OAuth ya está incorporado al piloto conectado. Importar mensajes sigue pendiente.

## Bancos dominicanos y navegación (2026-11-24)

El catálogo bancario inicial usa nombres de entidades operando del directorio de la Superintendencia de Bancos. La relación cuenta-banco se guarda en PostgreSQL para la cuenta personal y por dispositivo para la cuenta de prueba. Conexiones presenta una vista previa para los bancos registrados. Inicio mueve Presupuestos, Análisis y Tasas al menú de opciones. El área segura rodea la app y deja las barras del sistema fuera del contenido desplazable. Configuración incluye Acerca de la aplicación.

## Configuración, temas y fecha con hora (2026-11-24)

Configuración se divide en subpantallas y Acerca queda al final. Oscuro, Claro y Océano aplican tokens globales y persisten por dispositivo. Inicio abre Presupuestos, Análisis y Tasas desde un menú lateral. Los filtros de recepción y la creación de plantillas usan fecha y hora dominicana. Las plantillas con hora persisten su hora mensual y habilitan la confirmación al vencimiento. Las plantillas anteriores conservan el comportamiento UTC previo.

## Opciones de Configuración, tasas y EUR (2026-11-24)

Configuración utiliza opciones sin bordes ni flechas. Tasa del día abre la consulta existente de USD y EUR frente a DOP desde Configuración. EUR se admite en el modo local y en el conectado. La migración agrega un valor al enum de PostgreSQL. La moneda se conserva al guardar, exportar y agregar datos. Los parsers de retiros BHD y Popular siguen limitados a DOP.

## Navegación, formularios y apariencia (2026-11-24)

Las cuatro pestañas inferiores se muestran en las pantallas de la app, incluidas las abiertas desde el menú lateral. Editar un movimiento y crear una plantilla mensual abren pantallas separadas y vuelven a Movimientos. Se redujo el texto de la interfaz y se ampliaron los controles de acceso. El histórico de tasas usa fecha y hora dominicana y consulta al proveedor por día. Apariencia agrega Bosque, Violeta y Arena con la preferencia local existente.

## Funcionalidades de negocio por fases (2026-11-24)

La rama feat/finanzas-personales-por-fases reúne proyección de efectivo, metas de ahorro, pendientes, plan de deuda, gastos divididos, cierre mensual y reglas por comercio. La primera fase resta los gastos recurrentes activos pendientes hasta antes de la hora del próximo cobro, incluidos los vencidos. Calcula por moneda en centavos y guarda el saldo y el próximo cobro en el dispositivo, separados por modo. El gasto simulado se descarta al salir.

## Metas de ahorro y apartados (2026-11-24)

Fase 2 en la misma rama y PR que la proyección de efectivo. Metas por moneda con aportes manuales y vínculos a transferencias propias del historial. Cada transferencia se vincula a una meta como máximo. El avance considera el monto vigente del movimiento de origen y descuenta vínculos que ya no cumplen los requisitos. Quitar un aporte conserva el movimiento. Las metas se guardan en el dispositivo con separación demo/API.


## Pagos y cobros pendientes (2026-11-24)

Fase 3 en el mismo PR. Registra vencimientos por moneda con hora dominicana y aplica abonos manuales o movimientos vigentes del mismo tipo y moneda. Cada movimiento se puede vincular a un pendiente. Los pendientes se guardan en el dispositivo con separación demo/cuenta. La proyección descuenta el saldo de pagos antes del próximo cobro y sustituye un vencimiento mensual por su pendiente vinculado. Tras saldarlo, el cierre avanza la plantilla y conserva un recibo sin generar movimiento. El endpoint de cierre usa la transacción existente de recurrencias. La fase usa el esquema actual de PostgreSQL.

## Plan de pago de tarjetas y préstamos (2026-11-24)

Fase 4 en el mismo PR. Planes por dispositivo, separados entre demo y cuenta/URL conectada, con capital, cargos e interés al corte, tasa nominal anual fija, cuota y abono adicional mensual en DOP, USD o EUR. Las fechas usan hora dominicana. La primera cuota aplica los importes del corte antes del capital. Los períodos siguientes calculan interés nominal mensual sobre saldo en centavos, con redondeo a centavo y el día de vencimiento anclado. La comparación limita la proyección a 600 cuotas y señala cuota insuficiente. La simulación queda fuera del historial y usa almacenamiento local sin migración.

## Dividir gastos por categoría (2026-11-25)

Fase 5 en el mismo PR. El formulario manual de gastos distribuye el importe entre 2 y 12 categorías distintas de la moneda del movimiento y valida la suma en centavos. Historial y CSV conservan una fila, mientras que análisis y presupuestos consumen las partes. Los filtros consultan las categorías reales del reparto. En demo se conservan movimientos anteriores y partes locales. En modo conectado se agrega la migración aditiva MovementSplit. Las partes se escriben en la misma transacción del movimiento y conservan su categoría histórica.

## Cierre mensual personal (2026-11-25)

Fase 6 en el mismo PR. Desde Inicio se consulta por mes y moneda, con acceso al historial filtrado por Sin categorizar y a los pagos y cobros con saldo vigente y vencimiento dentro del mes. Utiliza los totales generales y por categoría, que ya incluyen repartos. El cierre guarda una copia con fecha, importes pendientes y límites de presupuesto, separada entre demo y cuenta/URL. Se puede actualizar explícitamente o consultar frente al cierre del mes anterior de la misma moneda. La captura usa los datos vigentes y no modifica el historial. Reutiliza los endpoints de presupuesto, movimientos y resumen sin una migración adicional.

## Reglas de categorización por comercio (2026-11-25)

Fase 7 y cierre de las siete fases del PR #21. Configuración permite crear, editar y eliminar reglas por frase o descripción exacta. La coincidencia normaliza mayúsculas, acentos y separadores, conserva la letra ñ, prioriza una descripción exacta y luego la frase más larga. Empates entre categorías distintas, categorías archivadas y categorías eliminadas quedan fuera de la sugerencia. El formulario manual de ingresos y gastos permite aplicar, omitir o corregir la sugerencia. Los repartos, las transferencias y la importación conservan sus propios flujos. Las reglas se guardan en el dispositivo por modo y cuenta/URL.

## Simulador de préstamos (2026-11-25)

Disponible en el menú lateral de Inicio como opción independiente en el PR #21. Calcula amortización mensual en DOP, USD y EUR con tasa nominal anual fija, plazo en cuotas y fecha y hora dominicana del primer pago. Suma comisión inicial pagada aparte y seguro fijo mensual opcional. Desglosa capital, interés, seguro, saldo y vencimiento por cuota. Ajusta centavos para cerrar con saldo cero y conserva el día del primer vencimiento entre meses cortos. La simulación vive en la pantalla y funciona en demo y conectado sin registrar movimientos ni guardar un plan.

## Menú global, FAQ y plazos de préstamos (2026-11-25)

El encabezado permanece visible en las pantallas de la cuenta. Explorar FlowSaldo concentra las herramientas que estaban sobre Resumen mensual y presenta opciones sin borde. Salir aparece al final del menú. Configuración agrega Preguntas frecuentes. Volver usa solo texto. El simulador asigna una fila completa a cada campo, admite amortización con un plazo indicado y compara 12, 24, 36, 48 y 60 cuotas cuando se deja vacío. La fecha opcional añade el calendario de pagos si se proporciona.

## Temas y ajustes de formularios en móvil (2026-11-25)

Apariencia conserva los seis temas y suma nueve, con muestras de color en el selector. El plan de pago coloca Volver encima del título y utiliza una fila por campo. Metas centra las acciones Cancelar. Preguntas frecuentes conserva sus respuestas y agrupa los acordeones por tema, alineados a la izquierda.

## Acceso y controles secundarios (2026-11-25)

El acceso agrupa las tres acciones debajo de Entrar como texto centrado sin bordes. Registro y recuperación vuelven al acceso con una flecha junto al título. Resumen mensual usa −7 días y +7 días para navegar semanas. Cancelar aporte manual queda centrado y sin borde.

## Devoluciones vinculadas a gastos (2026-11-25)

Movimientos permite registrar devoluciones parciales o totales con fecha y hora y tope acumulado por gasto. El reparto usa el saldo abierto por categoría y distribuye los centavos restantes de forma determinista. El gasto neto y el presupuesto se ajustan en el mes de la devolución. El historial y el CSV conservan el gasto original y las devoluciones por separado. El modo API añade Movement.refundOfId y reutiliza el bloqueo financiero y la clave idempotente. La cuenta de prueba usa almacenamiento local. Las devoluciones se corrigen eliminando y registrando de nuevo la entrada.

## Analíticas y reportes (2026-11-25)

El menú lateral incluye Analíticas y reportes con balance del mes, ingresos, gastos netos, presupuesto general y categorías, más la comparación con el mes anterior. Usa el selector de período y moneda y los mismos totales que el resumen. El reporte mensual CSV incluye una fila por indicador o categoría con importes firmados y moneda separada. Está disponible en demo y API y reutiliza los endpoints actuales.

## Respaldo y restauración local (2026-11-25)

Configuración ofrece exportar y restaurar un JSON versionado para el modo local. La copia conserva movimientos, repartos, devoluciones, categorías, presupuestos, bancos, plantillas y confirmaciones, revisiones y herramientas de planificación locales. Omite credenciales, preferencias del dispositivo y datos del modo conectado. Se valida y muestra una vista previa antes de reemplazar los datos locales en una sola escritura. Web descarga el archivo y Android usa el selector y el menú de compartir. El archivo tiene un límite de 2 MB y contiene datos sin cifrar.

## Cuentas y saldos locales (2026-11-25)

Configuración permite crear efectivo, cuentas bancarias y tarjetas en DOP, USD o EUR para la cuenta de prueba. El saldo inicial precede a los movimientos vinculados. Cada ingreso o gasto puede vincularse a una cuenta de la misma moneda. Las devoluciones heredan la cuenta del gasto y se reasignan en la misma escritura cuando se cambia su cuenta. El filtro de historial incluye las cuentas archivadas y conserva sus saldos. El respaldo JSON v2 añade las cuentas y acepta v1 con catálogo vacío. Las transferencias entre cuentas y la conciliación local corresponden a fases posteriores.

## Transferencias y pagos de tarjetas locales (2026-11-25)

La segunda fase vincula transferencias a dos cuentas distintas en la misma moneda o las conserva sin cuentas, como en el historial previo. Se guarda un solo movimiento. El importe se resta en el origen y se suma en el destino, incluso con tarjetas archivadas que conservan su historial. Una tarjeta de destino muestra el movimiento como pago de tarjeta. Los abonos quedan fuera de ingresos, gastos y metas de ahorro. Editar o eliminar recalcula ambos saldos. El historial se filtra por cualquiera de las dos cuentas y el respaldo v2 conserva los dos vínculos.

## Conciliación manual local (2026-11-25)

Cuentas y saldos compara una cuenta activa con el importe del estado de cuenta a una fecha y hora dominicanas. Para tarjetas se ingresa deuda positiva y saldo a favor negativo. Si hay diferencia, confirmar revalida el saldo al corte y agrega un solo ajuste identificado en el historial y CSV. Los ajustes afectan exclusivamente el saldo de esa cuenta. No alteran ingresos, gastos, presupuestos ni metas. El respaldo conserva sus importes. Una comparación que coincide no agrega movimientos.

## Recordatorios de vencimiento locales (2026-11-25)

En Android, Configuración → Notificaciones activa avisos por pagos pendientes y próximos vencimientos de plantillas mensuales de la cuenta de prueba. Los disparos se calculan en hora dominicana con la regla de fechas existente. Un pago vinculado sustituye el aviso de su plantilla. Abonos parciales conservan el aviso y saldar, pausar o confirmar evita que el aviso anterior siga activo. La preferencia pertenece al dispositivo y la programación se actualiza al guardar y al volver en primer plano. No se exponen nombres ni montos en las notificaciones. La app funciona con entrega aproximada y permite habilitar la hora exacta desde Android.

## Ajustes de navegación, conversión y abonos (2026-11-25)

Los controles de retorno usan iconos y los menús muestran un icono por opción. Las acciones secundarias independientes de cancelar o cerrar se centran. Conversión permite probar tasas USD y EUR a DOP con valores iniciales de Frankfurter y restaurarlos. La edición se limita a la pantalla y consulta activa. Los abonos manuales se pueden editar sin duplicar registros, con validación del saldo y conservando los movimientos vinculados. Cierre mensual apila ingresos y gastos.

## Consultas y operaciones de movimientos (2026-11-25)

El hook de historial centraliza paginación, filtros, totales API, vista previa de devoluciones, CSV e invalidaciones de las consultas dependientes. Los comandos de movimientos manejan alta, edición, devolución y eliminación para el modo local y conectado. App.tsx conserva el estado de navegación, los avisos y la persistencia compartida. El recorrido web restaura respaldos v1 y v2 y comprueba el vínculo de devolución.

## Escrituras locales en cola (2026-11-25)

El almacenamiento local serializa las transformaciones dentro de la misma instancia de la app. Cada escritura parte de la última versión confirmada y un error de guardado conserva esa versión. La restauración comprueba dentro de la cola que su vista previa siga vigente. Los vínculos locales de abonos, metas y devoluciones se verifican al ejecutar la escritura. El restablecimiento confirmado puede recuperar almacenamiento ilegible. Se mantienen la clave del almacenamiento y los formatos de respaldo v1 y v2.


## Aislamiento de datos conectados en el dispositivo (2026-11-25)

Las metas, los pendientes, las proyecciones, los planes de pago, los cierres mensuales, las reglas por comercio y la caché de consultas usan la URL base de la API y el identificador de la cuenta. Desarrollo tiene un ámbito propio por servidor. Los datos ya asociados a ese par conservan su clave. Las antiguas claves compartidas de metas, pendientes y proyecciones se mantienen sin asignación automática porque carecen de servidor verificable. Mi cuenta avisa si el dispositivo conserva estos registros. Restaurar un respaldo v1 o v2 y restablecer la demo mantienen los datos conectados y los registros antiguos. Exportar un respaldo incluye solo el contenido de la cuenta de prueba.

## Separación de las herramientas de planificación (2026-11-26)

Los hooks de metas y pendientes reúnen las consultas de movimientos vinculados y las operaciones de cada función. Los componentes de cierre mensual, proyección de efectivo y planes de pago encapsulan su cálculo, carga y guardado. App.tsx coordina las rutas, el período y los datos compartidos entre pantallas. La escritura conserva la cola local y el mismo ámbito por servidor y cuenta.

## Separación de presupuestos, plantillas e importaciones (2026-11-26)

Presupuestos concentra el límite general, las categorías, los totales y la copia explícita de límites antiguos al servidor. Plantillas mensuales gestiona su consulta, edición, activación y confirmación de vencimientos, incluidos los vinculados a pendientes. Por revisar reúne filtros de recepción, cola, paginación y operaciones de importación. App.tsx comparte el período, la sesión, la navegación y los datos necesarios para conectar las pantallas.
