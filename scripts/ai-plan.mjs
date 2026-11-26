import { validateManifest, validateTask } from './ai-contracts.mjs';

const checks = {
  frontend: ['pnpm check', 'pnpm test:web'],
  backend: ['pnpm check', 'node scripts/smoke.mjs'],
  data: ['pnpm db:generate', 'node scripts/smoke.mjs'],
  ingestion: ['pnpm check', 'node scripts/smoke.mjs'],
  fullstack: ['pnpm check', 'node scripts/smoke.mjs', 'pnpm test:web'],
  tooling: ['pnpm ai:validate', 'pnpm ai:test'],
};
export function createPlan(m, objective, scope) {
  validateManifest(m);
  if (typeof objective !== 'string' || !objective.trim() || objective.length > 2000)
    throw new Error('Objetivo vacío o demasiado largo');
  if (!Object.hasOwn(m.routes, scope) || !Object.hasOwn(checks, scope))
    throw new Error('Scope desconocido: ' + scope);
  const tasks = [];
  function add(id, agent, objective, dependsOn, requiredChecks = []) {
    const a = m.agents.find((a) => a.id === agent);
    tasks.push(
      validateTask(
        {
          id,
          agent,
          objective,
          scope: [...a.writablePaths],
          acceptance: [
            'Cumplir el objetivo acotado y los invariantes de AGENTS.md',
            'Entregar evidencia y límites según ai/templates/handoff.json',
          ],
          constraints: [
            'Solo datos sintéticos',
            'No ampliar autoridad ni delegar recursivamente',
            'Un dueño por archivo; coordinar rutas compartidas',
          ],
          requiredChecks,
          dependsOn,
        },
        m,
      ),
    );
    return id;
  }
  let previous = add('architecture', 'architect', 'Evaluar impacto: ' + objective, []);
  for (const id of m.routes[scope]) previous = add('implement-' + id, id, objective, [previous]);
  const qa = add('qa', 'qa', 'Validar criterios: ' + objective, [previous], checks[scope]);
  const sec = add('security', 'security', 'Revisar datos, permisos y seguridad: ' + objective, [
    previous,
  ]);
  const language = add(
    'language',
    'language-editor',
    'Revisar ortografía y concordancia: ' + objective,
    [qa, sec],
    ['pnpm text:check'],
  );
  const guardian = add(
    'exports',
    'export-guardian',
    'Revisar contrato de archivos exportados: ' + objective,
    [language],
    ['pnpm exports:test'],
  );
  const docs = add('documentation', 'docs', 'Documentar comportamiento y límites: ' + objective, [
    guardian,
  ]);
  const review = add(
    'review',
    'reviewer',
    'Revisar diff y evidencia de todas las tareas: ' + objective,
    [docs],
  );
  add(
    'integration',
    'orchestrator',
    'Integrar resultados verificados y preparar PR: ' + objective,
    [review],
    checks[scope],
  );
  return {
    version: 1,
    objective,
    scope,
    mode: 'plan-only',
    limits: m.limits,
    requiredHostControls: [
      'Aplicar concurrencia máxima y permisos',
      'Reservar archivos compartidos',
      'Verificar evidencia de checks',
      'No ejecutar modelos o comandos por leer este plan',
    ],
    tasks,
  };
}
