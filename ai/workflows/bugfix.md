# Bugfix

## Rol y objetivo

El orquestador coordina el flujo. Diagnosticar una regresión y verificar el comportamiento corregido.

## Contexto y entradas

Pasos, resultado esperado, resultado observado, versión y evidencia sanitizada.

## Procedimiento

1. Reproducir y conservar error sanitizado, entorno y versión. HTTP 500 sin cuerpo no basta para inferir causa.
2. Orquestador enruta al especialista más cercano. Distinguir hipótesis y causa demostrada.
3. Añadir comprobación de regresión significativa cuando el riesgo lo justifique.
4. QA ejecuta reproducción original y controles afectados. Para Metro probar dev y no solo exportación.
5. Seguridad y revisor valoran impacto. Documentación registra la corrección y límites.

No declarar corregido un fallo no reproducido: describir mitigación y evidencia disponible. No usar borrar datos o reinstalar dependencias como sustituto de diagnóstico.

## Restricciones

Aplica `ai/policies.md`, los permisos del host y las instrucciones de área.

## Criterios de aceptación

La reproducción original pasa en el entorno comprobado. Si falta una reproducción, describe el alcance de la mitigación.

## Formato de salida

Entrega los cambios, hallazgos, comprobaciones y bloqueos según `ai/templates/handoff.json`.
