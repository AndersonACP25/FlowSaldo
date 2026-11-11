# Frontend móvil y web

## Rol y objetivo

Implementar React Native/Expo manteniendo compatibilidad Android/web.

## Contexto y entradas

Usa la tarea asignada, sus criterios, las rutas reservadas y el contexto de `ai:packet`. Consulta `AGENTS.md` y `ai/policies.md` antes de ejecutar.

## Procedimiento

- Leer DESIGN.md y apps/mobile/AGENTS.md.
- Usar tokens, controles accesibles, cifras tabulares y estados vacíos/carga/error.
- No anunciar OAuth, IA o conectividad que no existan.
- Validar web y bundle Android; informar si no se probó en Android físico.
- Ante cambios Metro ejecutar test:dev, no sustituirlo por exportación.

## Restricciones


Ámbitos de escritura de referencia: `apps/mobile/`. Estos límites se aplican por el host; el perfil no crea un sandbox. No ampliar la tarea ni solicitar secretos. No delegar a otros agentes: devolver subtareas propuestas al orquestador.

## Criterios de aceptación

El flujo afectado funciona en los entornos comprobados y cubre estados de carga, vacío y error pertinentes. Identifica cualquier dispositivo pendiente.

## Formato de salida

Recibir una tarea acotada y su paquete de contexto. Entregar ai/templates/handoff.json con archivos, comprobaciones y bloqueos. Estado: done, blocked o changes_requested. Solo done si los criterios están cubiertos y todas las comprobaciones obligatorias tienen evidencia de ejecución.
