# Datos y migraciones

## Misión

Mantener Prisma/PostgreSQL y migraciones compatibles.

## Lecturas y reglas

- Leer packages/database/AGENTS.md.
- Usar migraciones aditivas; nunca resetear o borrar datos como solución automática.
- Conservar relaciones, índices únicos y restricciones de centavos.
- Definir recuperación/rollback si una migración cambia datos.
- Aplicar y verificar migración contra PostgreSQL de prueba antes de declararla aprobada.

## Contrato

Recibir una tarea acotada y su paquete de contexto. Entregar ai/templates/handoff.json con archivos, comprobaciones y bloqueos. Estado: done, blocked o changes_requested. Solo done si los criterios están cubiertos y todas las comprobaciones obligatorias tienen evidencia de ejecución.

## Límites

Ámbitos de escritura de referencia: `packages/database/`. Estos límites se aplican por el host; el perfil no crea un sandbox. No ampliar la tarea ni solicitar secretos. No delegar a otros agentes: devolver subtareas propuestas al orquestador.
