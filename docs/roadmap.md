# Próximas fases

## Completado en v0.2

Demo persistente; CRUD manual local y API; filtros por mes, moneda, tipo y texto; presupuesto local; gastos por categoría; CSV web y compartir texto nativo; scripts web/Expo Go; MEMORY.md. Pruebas de dominio, Playwright y CI PostgreSQL.

## Completado en v0.3

Diseño Dark Slate según DESIGN.md, navegación inferior, flujo de siete días, bandeja de revisión manual demo/API, confirmación transaccional y descarte de importaciones, detalle de correo sintético y laboratorio de importación. Launcher web con caché limpia y prueba del bundle Metro dev en Windows/Linux.

## Pendiente

1. Validar en Android físico y generar APK preview. Añadir pruebas Appium y accesibilidad nativa.
2. Añadir usuarios, sesiones, HTTPS, almacenamiento seguro de tokens, revocación, retención y eliminación.
3. Seleccionar Gmail u Outlook y un banco; recopilar muestras anonimizadas. Resolver requisitos de OAuth antes de conectar datos reales.
4. Implementar conector incremental, cursores y parsers bancarios versionados. Backoff/recuperación de la cola sintética completados en v0.7; integrarlos al futuro conector real. Deduplicar avisos distintos de una misma operación sigue pendiente.
5. Añadir cuentas, tarjetas/deuda, conciliación; sincronizar presupuestos por usuario.
6. Validar exportación CSV nativa en Android físico y ejecutar el piloto personal (archivo nativo implementado en v0.6).

IA opcional después de validar parsers deterministas. Ningún dato de correo debe ejecutar instrucciones ni acciones. Casos inciertos pasan por revisión humana.


## Lote v0.6

1. Entrega 1: historial paginado, agregaciones mensuales, exportación completa y filtros de revisiones. Implementado en este PR; ver validación y límites en su descripción.
2. Entrega 2: categorías administrables, presupuestos por categoría y registro rápido. Implementado en el mismo PR; ver validación y migración en su descripción.
3. Entrega 3: comparación mensual, recurrencias, trazabilidad revisión → movimiento y archivo CSV nativo implementados en el mismo PR. Validación de compartir en Android físico pendiente.


## Lote v0.7

Cola sintética recuperable, reintentos limitados, FAILED/reencolado manual y resumen de estado completados en el mismo PR. Siguientes fases: identidad/sesiones/HTTPS, proveedor OAuth y muestras anonimizadas, cuentas/conciliación y validación Android. Los estados de cola no implican que se haya conectado un proveedor de correo real.
