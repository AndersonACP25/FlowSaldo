# IA de desarrollo de FlowSaldo

Directorio neutral para coordinar asistentes de programación. `ai/` y `manifest.json` son convenciones del proyecto, no un formato universal ni una configuración nativa de Claude/OpenCode/Codex. AGENTS.md es el punto de entrada compartido; un host que no lo descubra debe recibir una instrucción explícita para leerlo.

## Uso rápido

Desde la raíz, con Node 24, sin dependencias ni claves:

```powershell
pnpm ai:validate
pnpm ai:plan --task "Agregar filtros por categoría" --scope frontend
pnpm ai:packet --task "Agregar filtros por categoría" --scope frontend --agent frontend
pnpm ai:test
```

`ai:plan` emite JSON en stdout con el grafo de tareas, responsables y dependencias. Es un borrador: el orquestador debe sustituir los criterios genéricos por criterios verificables de la solicitud antes de delegar. `ai:packet` emite instrucciones y contexto para copiar al host elegido. No ejecutan modelos, shell de terceros, MCP ni cambios del producto. Solo leen archivos del repositorio. La delegación efectiva y el control de permisos corresponden a tu editor/CLI o a un futuro adaptador. Sin capacidad de subagentes, ejecuta los roles secuencialmente y declara que no hubo revisión independiente.

Para guardar un plan local sin versionarlo: `pnpm ai:plan --task "Corregir filtro" --scope frontend > ai/runs/plan.txt`. El prefijo de npm puede añadir su cabecera; para JSON limpio utiliza `node scripts/ai.mjs plan --task "Corregir filtro" --scope frontend > ai/runs/plan.json`. La carpeta existe y su contenido está ignorado excepto .gitkeep. Revisar siempre las instrucciones antes de compartirlas con un modelo externo.

## Agentes y flujo

El orquestador recibe el objetivo y genera tareas para arquitectura, implementadores del área, QA, seguridad, documentación y revisión. Los implementadores se encadenan para evitar escrituras simultáneas. QA, seguridad y documentación parten tras la implementación; QA y documentación requieren acordar archivos si se solapan. El máximo de dos agentes en paralelo debe aplicarlo el host; el CLI solo produce el plan. El revisor espera todas esas entregas y el orquestador integra la conclusión.

No existe una relación de herencia mágica: un subagente es el mismo perfil ejecutado con contexto y autoridad más acotados. Los especialistas no pueden delegar recursivamente.

## Portabilidad

- `AGENTS.md`: instrucciones comunes, con archivos por área.
- `MEMORY.md`, `DESIGN.md`, `TESTING.md`, `SECURITY.md`: convenciones documentales de FlowSaldo.
- `ai/agents/*.md`: perfiles transferibles como texto.
- `ai/manifest.json`: catálogo y rutas usados por nuestro CLI.
- `ai/templates/`: contratos propios para tarea/entrega.
- `ai/workflows/`: procedimientos y criterios de salida.
- `docs/decisions/`: decisiones arquitectónicas.

No se crean CLAUDE.md, GEMINI.md, .opencode ni otras copias que puedan divergir. Si un proveedor necesita adaptador, deberá apuntar aquí y mantener esta fuente única. No se configura MCP sin una necesidad y permisos concretos.

## Estado v0.4

Infraestructura de IA para desarrollar el proyecto. La app mantiene la funcionalidad v0.3. No incluye IA financiera, conexión de correo real ni ejecución automática de agentes. Los perfiles orientan; no garantizan comportamiento de un LLM. El validador comprueba estructura/enlaces/contratos, no la veracidad de lo que declara un agente.

## Validar una entrega

Copiar la plantilla de tarea y entrega a ai/runs y completar con resultados reales. Luego:

```powershell
pnpm ai:handoff --task-file ai/runs/task.json --file ai/runs/handoff.json
```

Las plantillas tienen esquemas JSON en templates/*.schema.json para editores. El CLI usa validadores propios y comprobaciones cruzadas; no incorpora un motor JSON Schema general. Una entrega blocked con motivo puede ser consistente sin estar terminada. Solo done exige checks obligatorios pass y ausencia de bloqueos o hallazgos graves. El validador no ejecuta los comandos ni verifica la autenticidad del texto de evidencia.

## Iniciar una sesión en cualquier host

Usa ai/prompts/start.md o pega: «Lee AGENTS.md, MEMORY.md y ai/README.md. Actúa como el orquestador de ai/agents/orchestrator.md para esta tarea: [objetivo]. Genera un plan, respeta scopes y contratos y usa solo las herramientas autorizadas del host. Si no tienes subagentes, ejecuta secuencialmente y declara esa limitación».

## Referencias de formato

AGENTS.md toma como referencia https://agents.md/. Los perfiles, manifest, planificador y contratos bajo ai/ son propios de FlowSaldo. Los Agent Skills con SKILL.md son otro formato portable (https://agentskills.io/specification); no se instalan skills ni se asume su descubrimiento en esta versión.

## Nuevos controles v0.5

El catálogo incluye language-editor y export-guardian, ambos de solo lectura. El plan pasa por revisión lingüística y de exportaciones después de QA/seguridad y antes de documentación/revisión final. Las correcciones pertenecen al implementador. Consultar LANGUAGE.md y docs/exports.md.
