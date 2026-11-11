# Próximas fases

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
