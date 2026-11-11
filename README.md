# FlowSaldo ↗ · v0.10

Base Android de finanzas personales: React Native + Expo + TypeScript, Express, worker y PostgreSQL con Prisma.

**Estado:** prototipo personal de desarrollo. La app abre en modo demo sin backend. No conecta Gmail/Outlook ni interpreta correos bancarios reales. El parser solo reconoce el formato sintético documentado. No usar datos financieros reales ni exponer esta API a Internet.

## Arranque rápido

Desde el clon, con Node 24.11+ de la serie 24 y pnpm 10.34.7:

```powershell
pnpm install --frozen-lockfile
pnpm web
```

Pulsa **Explorar demostración**. En Android usa `pnpm start` con Expo Go o `pnpm android` con un emulador iniciado.

- [Guía desde el clon](docs/setup.md) para preparar PostgreSQL, arrancar API y worker y configurar la cuenta.
- [Generar el APK preview](docs/pilot.md#compilar-e-instalar-el-apk) para compilar con EAS, instalar en el teléfono y probar la conexión HTTPS.
- [Pruebas](TESTING.md) para checks locales y CI.
- [Prompts y orquestación](ai/README.md) para preparar tareas y contexto de agentes.

La demo guarda movimientos y presupuestos ficticios en el dispositivo. El modo API ofrece historial paginado, presupuestos en servidor y sesiones personales. Web guarda la sesión en memoria y Android usa SecureStore. En ambos modos, el CSV incluye todos los resultados del filtro. Los avisos sintéticos desconocidos pasan a revisión y requieren confirmación antes de generar movimientos.

## Organización

| Ruta | Responsabilidad |
|---|---|
| apps/mobile | App Expo, React Query y demo |
| apps/api | API Express, Zod, token personal de desarrollo |
| apps/worker | Importación persistida y procesamiento asíncrono |
| packages/domain | Reglas puras, parser sintético y pruebas |
| packages/database | Prisma, migración, seed y cliente PostgreSQL |
| docs | Arquitectura, contrato API y próximos pasos |

Consulta [arquitectura](docs/architecture.md), [API](docs/api.md) y [roadmap](docs/roadmap.md).

## Memoria del proyecto

[MEMORY.md](MEMORY.md) registra decisiones, alcance y validación. No incluir datos personales ni secretos en ese archivo.

## Diagnóstico del 500 en el bundle web

La ruta `/apps/mobile/index.ts.bundle?...` es un recurso generado por Metro, no un endpoint de Express. La versión 0.3 inicia Expo desde apps/mobile y limpia la caché con `--clear` mediante un launcher Node compatible con Windows. La URL reportada se prueba en CI con dev=true, lazy=true y transform.engine=hermes en Windows y Linux, además de cargar la interfaz en navegador.

Si vienes de una versión anterior, detén Metro (Ctrl+C) y ejecuta desde la raíz:

```powershell
pnpm install --frozen-lockfile
pnpm web
```

Si vuelve a devolver 500, copia el cuerpo de esa respuesta y el error de la terminal Metro: el código de estado por sí solo no identifica la causa. Comprueba Node 24 con `node --version`. No necesitas iniciar PostgreSQL para abrir la demo. La URL reportada respondió 200 en la reproducción con instalación limpia; no se confirmó la causa del fallo original de tu PC.

## Actualización de datos v0.2 -> v0.3

Se conserva la clave local `flowsaldo.demo.v2` para no borrar movimientos ni presupuestos. Si faltan revisiones, se agregan las muestras sintéticas iniciales al leer los datos. Las revisiones confirmadas o descartadas se guardan junto con la demo. Para API aplica `pnpm db:migrate` después de actualizar: añade DISMISSED sin borrar tablas.

## v0.4 — Agentes de desarrollo

La app conserva funcionalidad v0.3. Esta entrega añade [coordinación IA neutral](ai/README.md): perfiles, orquestador, contratos, políticas y CLI sin proveedor. No necesita API keys.

```powershell
pnpm ai:validate
pnpm ai:plan --task "Agregar filtros de categoría" --scope frontend
pnpm ai:packet --task "Agregar filtros de categoría" --scope frontend --agent frontend
pnpm ai:test
```

El planificador prepara el trabajo; tu editor/CLI ejecuta los roles. No inicia modelos ni agentes por sí solo. Consultar CONTRIBUTING.md, TESTING.md, SECURITY.md y CHANGELOG.md.

## v0.5 — pnpm, cuenta y controles de calidad

Usar exclusivamente pnpm en el proyecto. pnpm-workspace.yaml declara workspaces, nodeLinker hoisted para compatibilidad Expo y la lista explícita de scripts de instalación permitidos. pnpm-lock.yaml sustituye package-lock.json; los paquetes internos usan workspace:*.

Al migrar una instalación anterior, detener Expo, eliminar únicamente los directorios node_modules de raíz y workspaces si existen (sin borrar .env ni datos), instalar pnpm y ejecutar:

```powershell
pnpm install --frozen-lockfile
pnpm web
# O para Android físico:
pnpm start
```

Los perfiles language-editor y export-guardian se añaden al plan de IA. pnpm text:check detecta errores conocidos; la revisión lingüística completa sigue a cargo del perfil y su host. CSV se descarga con nombre FlowSaldo y seis columnas con encabezados en mayúscula inicial. El guardián de desarrollo también inspecciona archivos Excel .xlsx reales. La app conserva exportación CSV; no añade exportador Excel.

```powershell
pnpm exports:test
pnpm exports:check FlowSaldo-2026-10.csv Reporte.xlsx
```

La preferencia local de privacidad no cifra datos ni autentica usuarios. No introducir credenciales reales en las pantallas de vista previa. La confirmación de registro e inicio de sesión está deshabilitada explícitamente.


## v0.6 — Entrega 1 del lote: historial completo

La API conserva los endpoints anteriores para compatibilidad e incorpora paginación por cursor con `page=true`, resumen mensual agregado y CSV completo por mes/moneda/tipo/búsqueda. Movimientos y revisiones ofrecen Cargar más. Por revisar añade estados y fechas de recepción; el contador pendiente no depende del filtro. Los avisos demo antiguos sin fecha permanecen visibles sin filtro de fechas. No cambia la clave local ni se borran datos. API y app deben actualizarse juntas; la entrega 2 requiere la migración aditiva de categorías. Se mantienen acceso demo, proveedores de correo pendientes y presupuestos locales.

Las pruebas de integración incluyen más de 200 movimientos y 100 revisiones, fechas repetidas, monedas, transferencias, CSV completo, cursor cuya fila fue eliminada y validación. Las categorías administrables, presupuestos por categoría y recurrencias quedan para las próximas entregas.


## v0.6 — Entrega 2: categorías, presupuestos y registro rápido

En Configuración puedes crear, renombrar, archivar y reactivar categorías del modo actual. Los movimientos conservan sus etiquetas históricas y un identificador estable permite filtrarlos aunque la categoría cambie de nombre. Los formularios solo asignan categorías activas; una edición puede conservar su categoría archivada. Sin categorizar es una categoría protegida.

Panel permite límites por categoría, separados por mes, moneda y modo demo/API, con gastado, disponible, exceso y avisos al 80 % y 100 %. Siguen guardados en el dispositivo, al igual que el presupuesto general. Las transferencias propias no consumen los límites. Archivar o renombrar conserva el presupuesto.

Nuevo movimiento propone la fecha actual al trabajar en el mes vigente y el primer día para otros meses; mantiene entrada de fecha y añade calendario. Categorías recientes permite reutilizar categorías del historial cargado. Duplicar abre un borrador editable con fecha propuesta; solo Guardar movimiento crea el registro.

Antes de usar la API y el worker actualizados:

```powershell
pnpm db:generate
pnpm db:migrate
```

La migración agrega el catálogo y vincula los registros existentes sin borrar sus datos. La demo conserva `flowsaldo.demo.v2` y actualiza su estructura al leerla; categorías y límites se guardan al realizar una acción. No reinicies la demo para actualizar. La sincronización de presupuestos entre dispositivos continúa pendiente.


## v0.6 — Entrega 3 y alcance de pruebas

Panel compara ingresos/gastos con el mes anterior de la misma moneda. Muestra variación absoluta y porcentual; una base anterior cero con importe actual positivo se indica como Sin base de comparación. Se comparan totales registrados de ambos meses: el mes actual puede estar en curso. Los totales son completos y las transferencias propias siguen excluidas. Se muestran las cinco principales categorías de gastos.

Movimientos incluye plantillas recurrentes mensuales. Define descripción, importe, tipo, moneda, categoría y fecha inicial; después puedes editar los datos o pausar/reactivar. El día 31 se ajusta al final de febrero y vuelve al 31 en marzo. Las fechas de inicio y el calendario original no cambian al editar. Al reactivar se conservan los vencimientos pendientes. **Registrar vencimiento → Confirmar registro** crea un movimiento con la fecha del vencimiento, nunca de forma automática. Las confirmaciones se registran aparte: eliminar el movimiento no permite repetir un vencimiento confirmado. Si cambian los datos de una plantilla mientras se confirma, se exige revisarlos de nuevo. La API usa el día UTC para disponibilidad de vencimientos.

En revisiones confirmadas, Ver movimiento generado abre el registro vinculado. Si se elimina, se informa que ya no está disponible y no se reconstruye ni se vuelve a contabilizar.

Android comparte un archivo `FlowSaldo-AAAA-MM.csv` mediante expo-file-system y expo-sharing, con MIME text/csv. El archivo temporal permanece en caché administrada por el sistema para que la app receptora pueda leerlo. Web conserva la descarga completa. El comportamiento de compartir entre apps requiere validación en Android físico; generar el bundle no lo certifica.

Para actualizar la API/worker: `pnpm install --frozen-lockfile`, `pnpm db:generate` y `pnpm db:migrate`. Se añade la migración aditiva de plantillas/confirmaciones; no borra movimientos existentes. La demo conserva su clave y añade listas vacías de plantillas/confirmaciones al leer datos anteriores.

Por regla del proyecto, las unitarias y Playwright cubren solo reglas CORE y recorridos críticos. Actualmente hay **9 casos de dominio y 3 recorridos web**, sin revisar cada pantalla ni duplicar las combinaciones de API en UI. El smoke de Metro y las pruebas transaccionales de PostgreSQL son independientes. Ver TESTING.md y AGENTS.md antes de añadir nuevos tests.


## v0.7 — Importaciones recuperables

Conexiones incorpora Estado de importaciones: En cola, Procesando, Por revisar y Con error, con reintentos programados y procesamientos a recuperar. Son datos registrados en PostgreSQL; no se presenta un estado ficticio de conexión del worker. La información se actualiza mientras consultas Conexiones o la bandeja.

El worker intenta procesar cada aviso hasta cinco veces, con espera creciente ante fallos. Si se detiene durante un aviso, otro proceso puede recuperarlo después de 30 segundos. Al agotarse los intentos aparece Con error. Desde Por revisar → Con error puedes revisar el aviso y pulsar Reintentar importación → Confirmar reintento, iniciando un ciclo nuevo limitado. Se conserva la protección contra duplicados; los avisos desconocidos siguen requiriendo revisión humana.

Para actualizar, detén API/worker y ejecuta `pnpm install --frozen-lockfile`, `pnpm db:generate` y `pnpm db:migrate`. Luego reinicia ambos. La migración agrega estados/metadatos sin restablecer registros. Los contadores nuevos empiezan desde la actualización y no inventan actividad anterior.

Se mantienen 9 unitarias CORE y 3 recorridos Playwright; el recorrido API existente también comprueba el reintento manual. Recuperación, espera, concurrencia y duplicados se verifican en integración PostgreSQL, sin una matriz nueva de pruebas de pantallas.


## v0.8 — Acceso personal

1. Detén API/worker anteriores y actualiza: `pnpm install --frozen-lockfile`, `pnpm db:generate`, `pnpm db:migrate`. Reinicia ambos y configura EXPO_PUBLIC_API_URL como antes.
2. En la pantalla de acceso, pulsa Configurar cuenta inicial. Usa nombre/correo ficticios, contraseña de al menos 15 caracteres y el DEV_API_TOKEN de tu instalación como Token de configuración inicial. No se restablecen datos; la cuenta se asocia a la instalación existente.
3. Pulsa Ir a iniciar sesión y entra con la nueva cuenta. Desde ese momento el token de desarrollo deja de autorizar datos: no es una contraseña alternativa ni de recuperación.
4. Configuración → Cuenta personal permite cerrar sesión, consultar/cerrar otras sesiones y cambiar contraseña. Cambiarla cierra todas las sesiones y exige entrar de nuevo. La recuperación por correo y eliminación de cuenta aún no están disponibles; conserva tu contraseña de prueba.

Una cuenta por instalación. Los movimientos/importaciones/categorías anteriores se mantienen; la demo continúa separada. No existe registro abierto multiusuario. Las sesiones duran 24 horas y se pueden revocar. Web conserva el token solo en memoria, así que recargar exige iniciar sesión. Android/iOS usa SecureStore y valida la sesión antes de restaurarla; su comportamiento en dispositivo físico sigue pendiente de validación.

El cliente bloquea HTTP público; permite localhost/IPv4 privada para desarrollo. En modo producción la API exige HTTPS; HTTPS directo está disponible con archivos PEM; falta desplegarlo con un certificado público. No reutilices contraseñas reales en esta fase. Ver SECURITY.md para los límites y la configuración de proxy confiable.

Las unitarias siguen en 9 casos CORE. Se añade solo un cuarto recorrido Playwright de acceso/cambio/cierre, justificado por el nuevo riesgo de credenciales y revocación; el resto de combinaciones de seguridad se valida en API/PostgreSQL.


## v0.9: recuperar acceso y limpiar contenido antiguo

En Configuración → Recuperación de cuenta, confirma la contraseña para generar cinco códigos. Guárdalos fuera del dispositivo: se muestran una vez, se ocultan a los cinco minutos y vencen en 90 días. En el acceso, «Recuperar cuenta con código» permite restablecer la contraseña sin enviar correo. Recuperar, cambiar contraseña o regenerar códigos invalida el lote anterior; recuperar también cierra todas las sesiones. Sin código vigente ni contraseña no hay recuperación autoservicio ni bypass mediante el token inicial.

En Configuración → Privacidad y contenido antiguo, selecciona 7–365 días y previsualiza. Confirma con contraseña y el texto ELIMINAR CONTENIDO. Se descarta el texto de hasta 1000 avisos antiguos Por revisar/Con error sin movimiento; se conservan movimientos, categorías, presupuestos, recurrencias y trabajos activos. La vista previa enumera IDs exactos, vence en 10 minutos y es de un uso. También limpia credenciales caducadas/revocadas y limitadores antiguos. No elimina la cuenta ni implementa retención automática.

Para actualizar desde v0.8, detén API/worker, ejecuta `pnpm db:generate` y `pnpm exec prisma migrate deploy --config packages/database/prisma.config.ts`, y reinicia ambos con esta versión. Migración aditiva recovery_retention; no exige reset ni borra datos al migrar. El estado completo del plan está en [docs/roadmap.md](docs/roadmap.md).


## v0.10 — Cuentas, tarjetas, préstamos y conciliación

En modo API, abre Configuración → Administrar cuentas y conciliación. Crea cuentas bancarias, efectivo, tarjetas de crédito o préstamos en DOP o USD. El saldo inicial es explícito y anterior a todos los movimientos que vincules; para tarjetas/préstamos la deuda inicial se registra con signo negativo. Tipo, moneda y saldo inicial quedan fijos. Puedes renombrar, archivar y reactivar; archivar conserva datos. Los movimientos anteriores permanecen sin cuenta, sin modificar importes ni indicadores.

En Nuevo/Editar movimiento puedes asignar una cuenta de la misma moneda; los confirmados por correo también pueden asignarse manualmente. Para pagar una tarjeta/préstamo, selecciona Transferencia, cuenta de origen y cuenta de deuda como destino. Ambas deben usar la misma moneda. El traslado afecta ambos saldos y se excluye de ingresos/gastos. Las compras de tarjeta son gastos; los pagos de principal no se vuelven a contar como gasto. No se calculan intereses, cuotas, vencimientos ni tipos de cambio automáticamente. Las importaciones y recurrencias sin cuenta siguen fuera de estos saldos hasta asignarlas.

Movimientos incluye filtro por cuenta (origen o destino) y exportación CSV completa del conjunto filtrado. Los saldos son registros personales, no saldos bancarios consultados en línea. La deuda es la parte negativa del saldo en tarjetas/préstamos; crédito disponible registrado = límite + saldo. Se permite registrar sobregiros/excesos para reflejar diferencias reales; no se simula autorización bancaria.

Para conciliar, selecciona una cuenta, fecha al cierre del día UTC y saldo del estado de cuenta. Comparar muestra la diferencia; solo puedes confirmar cuando es cero. La confirmación rechaza vistas desactualizadas y protege el historial vinculado hasta esa fecha, incluyendo transferencias. No genera ajustes ni permite reabrir el período en esta versión. Los movimientos posteriores pueden continuar; consultar conciliaciones muestra los últimos 100 registros.

Los límites mensuales y por categoría del modo API se sincronizan mediante el servidor. Actualizar presupuestos consulta otros dispositivos; un conflicto exige revisar datos antes de volver a guardar. La demo sigue siendo local. Los antiguos límites API del dispositivo no se sobrescriben ni copian automáticamente: en un período vacío aparece la acción para copiar el límite general y categorías activas, conservando respaldo local.

Actualización: detén API/worker, ejecuta `pnpm install --frozen-lockfile`, `pnpm db:generate` y `pnpm exec prisma migrate deploy --config packages/database/prisma.config.ts`, y reinicia. Migración aditiva financial_accounts, sin reset. Consulta la sección de mantenimiento para la retención automática, los respaldos y el borrado.

## Mantenimiento de datos

El worker puede limpiar hasta 1 000 avisos por ciclo, al arrancar y cada hora. Configura `AUTO_RETENTION_DAYS` entre 7 y 365 para activarlo. El valor 0 lo desactiva. Solo limpia el cuerpo de avisos en revisión o con error sin movimiento vinculado. Conserva sus identificadores, registra las cantidades y deja los avisos como descartados.

Los comandos de mantenimiento requieren `psql`, `pg_dump` y `pg_restore` compatibles con el servidor en el PATH. Usa una ruta fuera del repositorio y conserva juntos el archivo y su suma SHA-256.

```sh
pnpm data:admin backup /ruta/FlowSaldo.dump
```

El respaldo incluye los datos financieros y el hash de contraseña. Custódialo como dato privado. Las sesiones, los códigos de recuperación, los límites de acceso y las vistas previas quedan excluidos. La suma detecta daños accidentales. Restaura exclusivamente archivos de procedencia confiable.

Para verificar una restauración, crea una base PostgreSQL vacía, apunta `DATABASE_URL` a ella y ejecuta `pnpm data:admin restore /ruta/FlowSaldo.dump`. Comprueba la cuenta, los saldos y los movimientos en esa instalación aislada antes de usarla. El comando compara la suma y restaura dentro de una transacción. Después inicia una sesión nueva.

Para eliminar la cuenta y todos los datos de la instalación, detén API, worker y otros clientes. Comprueba la conexión, sustituye el ejemplo por el nombre exacto de la base y ejecuta:

```sh
pnpm data:admin erase nombre_exacto_de_la_base
```

La operación reinicia la cuenta y el catálogo inicial de categorías. Los archivos de respaldo, las copias externas y el almacenamiento local del dispositivo se gestionan por separado. Antes de reiniciar los servicios, verifica el token de configuración inicial.
