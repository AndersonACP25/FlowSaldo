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
