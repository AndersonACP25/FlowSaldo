# Feature

1. Orquestador: objetivo, criterios, exclusiones, alcance y archivos reservados.
2. Arquitectura: impacto en API/datos/diseño. ADR si hay decisión estructural.
3. Implementadores: cambios acotados respetando dependencias; no modificar la misma ruta en paralelo.
4. QA: pruebas por riesgo según TESTING.md y contrato de tarea. Seguridad: revisión de datos y permisos. Documentación: actualizar lo que cambió.
5. Revisor: contrastar diff, criterios y evidencia. No autoaprobar trabajo propio.
6. Orquestador: repetir como máximo dos rondas, integrar y presentar PR. Registrar límites reales y pruebas no ejecutadas.

Terminado exige criterios cubiertos, checks requeridos pass con evidencia y ningún hallazgo high/critical abierto. El CLI no ejecuta estos pasos por sí mismo; el host realiza y supervisa las tareas del plan.

Antes de documentación/revisión final: language-editor revisa textos (incluidos 0/1/N) y export-guardian revisa el contrato y los archivos efectivamente generados. Sus hallazgos se corrigen por el dueño del área.
