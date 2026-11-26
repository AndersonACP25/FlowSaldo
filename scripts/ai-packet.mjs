import { readRepo } from './ai-contracts.mjs';

export async function createPacket(root, m, plan, agent) {
  const profile = m.agents.find((a) => a.id === agent);
  if (!profile) throw new Error('Agente desconocido');
  const assigned = plan.tasks.filter((t) => t.agent === agent);
  if (!assigned.length) throw new Error('El agente no participa en este plan');
  if (!Object.hasOwn(m.routes, plan.scope)) throw new Error('Scope desconocido: ' + plan.scope);
  const areaProfiles = profile.readOnly
    ? m.agents.filter((area) => m.routes[plan.scope].includes(area.id))
    : [profile];
  const required = new Set([...m.context, m.policy, profile.profile]);
  const context = [];
  for (const path of required) context.push({ path, content: await readRepo(root, path) });
  const directories = new Set(areaProfiles.flatMap((area) => area.writablePaths));
  for (const directory of directories) {
    if (!directory.endsWith('/')) continue;
    const path = directory + 'AGENTS.md';
    if (required.has(path)) continue;
    try {
      context.push({ path, content: await readRepo(root, path) });
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return {
    mode: 'context-only',
    notice:
      'Revisar antes de compartir con un proveedor. No contiene secretos intencionados; el host controla qué transmite.',
    objective: plan.objective,
    agent,
    tasks: assigned,
    context,
  };
}
