# Próximas fases de FlowSaldo

## Plan de funcionalidades · noviembre de 2026

La prioridad es que FlowSaldo se pueda usar desde el navegador de la PC y una APK Android sin levantar PostgreSQL. El modo local ya incluye movimientos, categorías, presupuestos, comparación mensual, recurrencias y CSV. En el modo conectado, Gmail ya se puede autorizar y desconectar en el piloto local. La lectura de avisos del buzón sigue pendiente.

### Primera etapa · Sin PostgreSQL

| Prioridad | Funcionalidad | Criterio de aceptación |
| --- | --- | --- |
| P0 | Cuenta de prueba y piloto Android | Entrar, registrar un movimiento, volver a abrir la app y encontrarlo en web sin API y en la APK con modo avión. Verificar el CSV compartido en Android y la instalación sobre la versión anterior. |
| P1 | Respaldo y restauración local en JSON | Exportar movimientos, categorías y sus relaciones, presupuestos y recurrencias con una versión de formato. Validar y previsualizar el archivo antes de restaurar en otro dispositivo. Si falla la validación, conservar los datos actuales. Restaurar dos veces el mismo respaldo conserva los mismos totales. |
| P1 | Importación CSV con revisión previa | Mostrar filas válidas, posibles duplicados y errores con número de fila antes de confirmar. Conservar moneda y precisión. Reimportar el mismo archivo no duplica movimientos confirmados. |
| P2 | Recordatorios locales de vencimientos | Programar avisos de recurrencias en Android sin API. Editar o pausar una recurrencia actualiza o cancela su aviso. Registrar el vencimiento sigue requiriendo confirmación. |

### Segunda etapa · Cuando se retome PostgreSQL

| Orden | Funcionalidad | Criterio de aceptación |
| --- | --- | --- |
| 1 | Pasar datos locales a la cuenta personal | Ver una vista previa de los registros que se copiarán. Confirmar explícitamente el traspaso y conservar el respaldo local. Reintentar una carga interrumpida sin duplicar registros. |
| 2 | Sincronización manual desde Gmail | Usar el OAuth existente y un buzón de prueba. Enviar avisos admitidos de BHD y Popular a revisión. Reintentar tras un fallo sin duplicar avisos y modificar el saldo solo al confirmar. |
| 3 | Ampliar formatos bancarios | Añadir compras, transferencias y PayPal por lotes, con muestras anonimizadas por formato. Enviar avisos ambiguos a revisión y probar deduplicación entre avisos de la misma operación. |

La siguiente implementación después de validar el acceso en una APK física es el respaldo JSON. Puede servir para mover datos entre PC y Android y preparar el traspaso posterior a la cuenta personal.

## Funcionalidades de negocio por fases

Las siete fases están implementadas en `feat/finanzas-personales-por-fases` y se pueden probar con la cuenta de prueba.

| Fase | Funcionalidad | Estado y criterio de aceptación |
| --- | --- | --- |
| 1 | Disponible hasta el próximo cobro | Implementada. Con DOP 20,000 y DOP 12,000 en vencimientos pendientes, muestra DOP 8,000. Simular DOP 3,000 muestra DOP 5,000. La simulación se descarta al salir y el saldo base se guarda por moneda y modo. |
| 2 | Metas de ahorro y apartados | Implementada. Crea una meta por moneda, registra aportes y consulta el avance. Cada transferencia propia puede vincularse a una sola meta y conserva su clasificación. Las metas y vínculos se guardan en el dispositivo por modo. |
| 3 | Pagos y cobros pendientes | Implementada. Registra pagos y cobros con vencimiento, abonos parciales y vínculos a movimientos. La proyección usa el saldo por pagar antes del próximo cobro y contabiliza una vez cada vencimiento de plantilla. |
| 4 | Plan de pago de tarjetas y préstamos | Implementada. Guarda planes locales de tarjetas y préstamos con corte, vencimiento, capital, intereses y cargos. Compara cuotas, fecha estimada e intereses con un abono mensual adicional, con supuestos visibles. |
| 5 | Dividir gastos por categoría | Implementada. Permite repartir gastos entre categorías en la misma moneda. Las partes deben sumar el gasto y se distribuyen entre análisis y presupuestos. El historial conserva una sola fila. |
| 6 | Cierre mensual personal | Implementada. Revisa movimientos sin categorizar, saldos pendientes con vencimiento en el mes y diferencias frente al presupuesto. Guarda un resumen local por mes y moneda y compáralo con el cierre anterior. |
| 7 | Reglas de categorización por comercio | Implementada. Crea reglas por frase o descripción exacta en Configuración. El formulario manual sugiere la categoría y permite usarla, omitirla o elegir otra. Las reglas se guardan en el dispositivo. |

El simulador de préstamos también está disponible desde el menú de Inicio. Estima la cuota mensual, el costo total y el calendario a partir del monto, el plazo, la tasa anual fija, el primer pago y los cargos opcionales.

Las devoluciones parciales y totales se vinculan al gasto original. Reducen el gasto neto y el consumo de presupuesto en el mes en que se registran.

## Historial del roadmap

## Completado en v0.2

Demo persistente; CRUD manual local y API; filtros por mes, moneda, tipo y texto; presupuesto local; gastos por categoría; CSV web y compartir texto nativo; scripts web/Expo Go; MEMORY.md. Pruebas de dominio, Playwright y CI PostgreSQL.

## Completado en v0.3

Diseño Dark Slate según DESIGN.md, navegación inferior, flujo de siete días, bandeja de revisión manual demo/API, confirmación transaccional y descarte de importaciones, detalle de correo sintético y laboratorio de importación. Launcher web con caché limpia y prueba del bundle Metro dev en Windows/Linux.

## Pendiente

1. Validar en Android físico y generar APK preview. Añadir pruebas Appium y accesibilidad nativa.
2. Cuenta personal/sesiones/revocación/SecureStore y política HTTPS implementadas en v0.8. Recuperación offline y limpieza manual de contenido implementadas en v0.9. Pendientes: despliegue TLS real, validación nativa, eliminación completa/política automática y diseño multiusuario solo si se requiere.
3. Seleccionar Gmail u Outlook y un banco; recopilar muestras anonimizadas. Resolver requisitos de OAuth antes de conectar datos reales.
4. Implementar conector incremental, cursores y parsers bancarios versionados. Backoff/recuperación de la cola sintética completados en v0.7; integrarlos al futuro conector real. Deduplicar avisos distintos de una misma operación sigue pendiente.
5. Implementado en v0.10 para la cuenta personal: cuentas, tarjetas/préstamos, conciliación manual y presupuestos en servidor.
6. Validar exportación CSV nativa en Android físico y ejecutar el piloto personal (archivo nativo implementado en v0.6).

IA opcional después de validar parsers deterministas. Ningún dato de correo debe ejecutar instrucciones ni acciones. Casos inciertos pasan por revisión humana.


## Lote v0.6

1. Entrega 1: historial paginado, agregaciones mensuales, exportación completa y filtros de revisiones. Implementado en este PR; ver validación y límites en su descripción.
2. Entrega 2: categorías administrables, presupuestos por categoría y registro rápido. Implementado en el mismo PR; ver validación y migración en su descripción.
3. Entrega 3: comparación mensual, recurrencias, trazabilidad revisión → movimiento y archivo CSV nativo implementados en el mismo PR. Validación de compartir en Android físico pendiente.


## Lote v0.7

Cola sintética recuperable, reintentos limitados, FAILED/reencolado manual y resumen de estado completados en el mismo PR. Siguientes fases: identidad/sesiones/HTTPS, proveedor OAuth y muestras anonimizadas, cuentas/conciliación y validación Android. Los estados de cola no implican que se haya conectado un proveedor de correo real.


## Lote v0.8

Acceso personal real para una cuenta por instalación, conservación de datos existentes, sesión/revocación/cambio de contraseña y almacenamiento de credencial por plataforma. No habilita registro multiusuario, proveedor OAuth ni despliegue público. Próximas fases: validación Android, recuperación y política de datos, TLS operativo y selección de proveedor/banco para muestras anonimizadas.


## Estado actual del plan — v0.9 (2026-11-10)

El plan funcional original de ocho puntos está implementado; la validación física de exportación nativa sigue abierta. «Implementado» no equivale a preparación para producción.

| Punto original | Estado |
|---|---|
| Historial completo, paginación, totales y CSV | Implementado |
| Categorías administrables con historia estable | Implementado |
| Presupuestos por categoría y alertas | Implementado; almacenamiento local |
| Comparación mensual y principales gastos | Implementado |
| Registro rápido y duplicación como borrador | Implementado |
| Recurrencias con confirmación manual e idempotencia | Implementado |
| Revisión filtrada y trazabilidad al movimiento | Implementado |
| Archivo CSV nativo | Implementado; compartir en Android físico pendiente |

Lotes adicionales completados: v0.7 recuperación de cola, v0.8 cuenta personal/sesiones y v0.9 recuperación con códigos offline + limpieza manual de contenido. No se implementó recuperación por correo ni eliminación total de la cuenta.

| Trabajo restante | Dependencia o alcance |
|---|---|
| Android físico y APK preview | Probar SecureStore, compartir CSV y accesibilidad; generar build instalable |
| HTTPS operativo | Desplegar TLS y verificar acceso/revocación en ese entorno |
| Proveedor y banco | Elegir Gmail u Outlook y un banco; obtener muestras anonimizadas y requisitos OAuth |
| Correo real | OAuth, conector incremental/cursores, parsers versionados y deduplicación entre avisos de la misma operación |
| Modelo financiero ampliado | Implementado en v0.10: cuentas, tarjetas/préstamos, conciliación manual y presupuestos en servidor |
| Política de datos | Implementada mediante retención opcional y comandos de mantenimiento |

Siguiente lote recomendado: preparación y checklist ejecutable del piloto Android/HTTPS. La conexión bancaria real requiere primero proveedor/banco y muestras; no se inventarán formatos ni credenciales. Multiusuario e IA opcional no forman parte del plan original.


## Lote v0.10 — Punto #4 implementado

Cuentas y deuda con saldos explícitos por moneda, transferencias internas sin doble gasto, conciliación manual con período protegido y presupuestos del modo API guardados en servidor con control de versiones. UI disponible desde Configuración y Movimientos; demo local conservada. No calcula intereses/cuotas ni conecta saldos bancarios en línea. El historial anterior no se reasigna automáticamente.

Android físico/APK, TLS operativo y correo real siguen pendientes.

### Punto #5 — Mantenimiento de datos

El worker admite retención automática opcional de cuerpos de avisos. El operador puede respaldar, restaurar y borrar la cuenta y sus datos mediante comandos de mantenimiento. La integración restaura en una base aislada, verifica los datos y borra esa copia de prueba.


## Piloto Android y HTTPS

- HTTPS directo admite certificado y clave PEM. La integración prueba acceso y revocación contra el servidor HTTPS usando un certificado temporal de confianza.
- El perfil APK preview selecciona el entorno de EAS. La [guía del piloto](pilot.md) define las comprobaciones de SecureStore, CSV y accesibilidad.
- Pendientes externos: desplegar con un dominio y certificado público, generar el APK firmado y probarlo en Android físico. La integración de correo requiere elegir proveedor y banco y obtener muestras anonimizadas.
