import { ledgerBalance } from './finance.ts';
import { isCurrency, type Currency } from './finance.ts';
import type { Movement } from './movement.ts';

export type SavingsContribution = { id: string } & (
  { kind: 'manual'; amountMinor: number } | { kind: 'transfer'; movementId: string }
);

export interface SavingsGoal {
  id: string;
  name: string;
  currency: Currency;
  targetMinor: number;
  contributions: SavingsContribution[];
}

function validAmount(minor: number) {
  return Number.isInteger(minor) && minor > 0 && minor <= 2147483647;
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && !!value.trim();
}

export function checkSavingsGoal(goal: Pick<SavingsGoal, 'name' | 'currency' | 'targetMinor'>) {
  const name = goal.name.trim();
  if (!name || name.length > 60) throw new Error('Escribe un nombre de hasta 60 caracteres.');
  if (!isCurrency(goal.currency) || !validAmount(goal.targetMinor))
    throw new Error('Elige una moneda y un objetivo mayor que cero.');
  return { ...goal, name };
}

export function savingsTransferGoal(goals: SavingsGoal[], movementId: string) {
  return goals.find((goal) =>
    goal.contributions.some((item) => item.kind === 'transfer' && item.movementId === movementId),
  );
}

export function savingsContributionAmount(
  currency: Currency,
  contribution: SavingsContribution,
  transfers: ReadonlyMap<string, Movement>,
) {
  if (contribution.kind === 'manual') return contribution.amountMinor;
  const movement = transfers.get(contribution.movementId);
  return movement?.type === 'TRANSFER' &&
    movement.currency === currency &&
    validAmount(movement.amountMinor)
    ? movement.amountMinor
    : null;
}

export function addSavingsContribution(
  goals: SavingsGoal[],
  goalId: string,
  contribution: SavingsContribution,
  transfers: ReadonlyMap<string, Movement>,
) {
  const goal = goals.find((item) => item.id === goalId);
  if (!goal) throw new Error('La meta ya no está disponible.');
  if (goal.contributions.some((item) => item.id === contribution.id))
    throw new Error('Este aporte ya está registrado.');
  if (contribution.kind === 'manual') {
    if (!validAmount(contribution.amountMinor)) throw new Error('Importe de aporte inválido.');
  } else {
    if (savingsTransferGoal(goals, contribution.movementId))
      throw new Error('Esta transferencia ya está vinculada a una meta.');
    if (savingsContributionAmount(goal.currency, contribution, transfers) === null)
      throw new Error('Selecciona una transferencia disponible en la moneda de la meta.');
  }
  return goals.map((item) =>
    item.id === goalId ? { ...item, contributions: [...item.contributions, contribution] } : item,
  );
}

export function savingsProgress(goal: SavingsGoal, transfers: ReadonlyMap<string, Movement>) {
  const savedMinor = goal.contributions.reduce(
    (total, contribution) =>
      ledgerBalance(
        total,
        savingsContributionAmount(goal.currency, contribution, transfers) ?? 0,
        0,
        0,
      ),
    0,
  );
  return {
    savedMinor,
    remainingMinor: Math.max(0, goal.targetMinor - savedMinor),
    percent:
      savedMinor >= goal.targetMinor ? 100 : Math.floor((savedMinor * 100) / goal.targetMinor),
  };
}

export function validSavingsGoals(value: unknown): value is SavingsGoal[] {
  if (!Array.isArray(value)) return false;
  const goalIds = new Set<string>();
  const transferIds = new Set<string>();
  for (const goal of value as SavingsGoal[]) {
    if (
      !goal ||
      !validId(goal.id) ||
      goalIds.has(goal.id) ||
      typeof goal.name !== 'string' ||
      !goal.name.trim() ||
      goal.name.length > 60 ||
      !isCurrency(goal.currency) ||
      !validAmount(goal.targetMinor) ||
      !Array.isArray(goal.contributions)
    )
      return false;
    goalIds.add(goal.id);
    const contributionIds = new Set<string>();
    for (const item of goal.contributions) {
      if (!item || !validId(item.id) || contributionIds.has(item.id)) return false;
      contributionIds.add(item.id);
      if (item.kind === 'manual') {
        if (!validAmount(item.amountMinor)) return false;
      } else {
        if (
          item.kind !== 'transfer' ||
          !validId(item.movementId) ||
          transferIds.has(item.movementId)
        )
          return false;
        transferIds.add(item.movementId);
      }
    }
  }
  return true;
}
