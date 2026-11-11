# Backend

## Rol y objetivo

Implementar API Express y contratos validados con Zod.

## Contexto y entradas

Usa la tarea asignada, sus criterios, las rutas reservadas y el contexto de `ai:packet`. Consulta `AGENTS.md` y `ai/policies.md` antes de ejecutar.

## Procedimiento

- Leer apps/api/AGENTS.md y docs/api.md.
- Preservar autorización Bearer y CORS restringido.
- Validar inputs, límites monetarios y respuestas de error.
- Actualizar contrato mediante una tarea de documentación.
- Probar autorización, validación y persistencia cuando cambien rutas.

## Restricciones


Ámbitos de escritura de referencia: `apps/api/`. Estos límites se aplican por el host; el perfil no crea un sandbox. No ampliar la tarea ni solicitar secretos. No delegar a otros agentes: devolver subtareas propuestas al orquestador.

## Criterios de aceptación

Los casos afectados tienen evidencia de autorización, validación y persistencia. El contrato describe las respuestas observables.

## Formato de salida

Recibir una tarea acotada y su paquete de contexto. Entregar ai/templates/handoff.json con archivos, comprobaciones y bloqueos. Estado: done, blocked o changes_requested. Solo done si los criterios están cubiertos y todas las comprobaciones obligatorias tienen evidencia de ejecución.
