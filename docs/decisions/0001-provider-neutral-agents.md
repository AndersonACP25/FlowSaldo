# 0001 — Coordinación de agentes independiente del proveedor

Estado: propuesta en el PR de v0.4

## Contexto

Se necesita asistencia IA especializada para un monorepo Android/web, API, ingesta y datos sin depender del formato de un editor.

## Decisión

AGENTS.md como entrada común; ai/ como catálogo propio de perfiles, políticas y workflows. CLI Node sin dependencias para planificar, preparar paquetes y verificar estructura. El host ejecuta roles y aplica permisos; no se añade un runtime LLM a la app.

## Alternativas

Configuración exclusiva de un proveedor: facilita integración inicial pero acopla instrucciones. Runtime multiagente propio: permite automatización real pero añade credenciales, aislamiento, costes y herramientas antes de tener requisitos concretos.

## Consecuencias

Los perfiles se pueden trasladar como texto. No hay descubrimiento universal ni ejecución automática garantizada. Futuros adaptadores deben referenciar esta fuente única y aplicar permisos. Revertir esta capa no cambia el producto ni los datos financieros.
