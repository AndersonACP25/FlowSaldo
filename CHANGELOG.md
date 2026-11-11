# Cambios

## 0.5.0

- Migración a pnpm con workspaces, lockfile y CI.
- Inicio de sesión y registro visuales sin autenticación; Configuración con preferencias locales.
- Revisor lingüístico, reglas de conteo 0/1/N y detector de errores conocidos.
- Guardián de exportaciones con mayúscula inicial y columnas reales para CSV/Excel .xlsx.

## 0.4.0 — Infraestructura IA de desarrollo

- Catálogo neutral ai/ con orquestador, especialistas, contratos y workflows.
- CLI para generar planes, preparar contexto y validar entregas; sin dependencia de un proveedor ni ejecución de modelos.
- AGENTS.md por área y políticas de datos, delegación, evidencia y memoria.
- Documentación de contribución, seguridad, pruebas y decisiones arquitectónicas.
- Validación automática del catálogo y pruebas del planificador en CI.

Esta versión cambia herramientas de desarrollo. La interfaz y funciones de la app siguen en 0.3.0; OAuth e IA financiera continúan pendientes.

## 0.3.0

Diseño Dark Slate, revisión manual, flujo semanal y launcher Expo con prueba Metro dev en Windows/Linux.


## En desarrollo — v0.6, entrega 1

- Historial API paginado por cursor y Cargar más, conservando rutas legacy.
- Totales mensuales, categorías y flujo semanal completos calculados en servidor.
- CSV del conjunto filtrado completo y revisiones por estado/fecha con contador global.
- Integración de regresión con 205 movimientos y 105 revisiones; sin migración de datos.


### Entrega 2 del lote v0.6

- Catálogo administrable en demo/API: crear, renombrar, archivar y reactivar, sin perder etiquetas históricas.
- Migración aditiva con categoryId estable; filtros/exportación por ID y gasto mensual completo por categoría.
- Presupuestos locales por categoría/mes/moneda/modo, disponibles/excesos y avisos 80/100.
- Fecha actual, calendario, categorías recientes y duplicación editable que requiere guardar.


### Entrega 3 — v0.6.0

- Comparativa mensual completa, variaciones y tratamiento explícito de base cero.
- Plantillas mensuales confirmadas manualmente, con versionado, protección concurrente y ledger independiente de movimientos eliminados.
- Enlace de revisiones confirmadas al movimiento generado y archivo CSV adjunto en Android.
- Política QA: 9 casos unitarios CORE y 3 recorridos Playwright críticos; se eliminan recorridos de todo el sistema y duplicaciones de UI.
- Migración aditiva de recurrencias; nueva demo conserva datos previos. Compartir en Android físico pendiente de validación.


## v0.7.0 — Cola e importaciones recuperables

- Reservas de procesamiento durables con expiración, token de propietario y recuperación tras interrupción.
- Cinco intentos por ciclo con espera creciente; FAILED y reintento manual confirmado, conservando idempotencia.
- Estado real de importaciones en Conexiones, filtros Procesando/Con error y metadatos de intentos sin detalles sensibles.
- Migración aditiva sin reset; se mantienen 9 unitarias CORE y 3 recorridos críticos, con integración enfocada en recuperación/concurrencia.


## v0.8.0 — Acceso personal

- Setup de cuenta única asociado a datos existentes; el token inicial deja de autorizar datos una vez configurada.
- Login/logout, contraseña con scrypt, sesiones opacas expirables/revocables y cambio que cierra todas las sesiones.
- SecureStore nativo y sesión web solo en memoria; limpieza de caché al salir/expirar y URL/API de transporte restringida.
- Migración aditiva sin reset, rate limit persistido y protección contra login concurrente con cambio de contraseña.
- 9 unitarias CORE y 4 recorridos Playwright, añadiendo únicamente el riesgo crítico de acceso/cierre.


## v0.9.0 — Recuperación y privacidad

- Códigos de recuperación offline, guardados como hash, con caducidad y consumo único; recuperación revoca sesiones y lote anterior.
- Limpieza manual de contenido antiguo con vista previa limitada, contraseña y confirmación; conserva movimientos y trabajos activos.
- Migración aditiva recovery_retention y estado del plan actualizado.
- Se conservan 9 unitarias CORE y 4 recorridos críticos Playwright; integración PostgreSQL cubre recuperación concurrente y conservación de datos.


## v0.10.0 — Cuentas, deuda y conciliación

- Cuentas bancarias, efectivo, tarjetas y préstamos con saldos por moneda y archivo sin perder historia.
- Transferencias internas y pagos de deuda sin duplicar gastos; claves idempotentes de envío.
- Conciliación manual por fecha UTC con diferencias, versión e historial protegido.
- Presupuestos API en servidor, control de conflictos y copia explícita de límites locales anteriores.
- Migración aditiva y pruebas enfocadas en integridad financiera.
