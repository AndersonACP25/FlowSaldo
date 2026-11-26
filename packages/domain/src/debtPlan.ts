import { parseDominicanDateTime } from './dateTime.ts';
import { isCurrency, type Currency } from './finance.ts';
import { nextMonthlyDate } from './recurring.ts';
import { monthlyInterestMinor } from './finance.ts';

export type DebtPlanDraft = {
  name: string;
  kind: 'card' | 'loan';
  currency: Currency;
  statementAt: string;
  dueAt: string;
  principalMinor: number;
  statementInterestMinor: number;
  chargesMinor: number;
  annualRateBasisPoints: number;
  monthlyPaymentMinor: number;
  extraMonthlyMinor: number;
};

export type DebtPlan = DebtPlanDraft & { id: string };

const maxAmount = 2_147_483_647;
export const maxDebtPlanMonths = 600;

function validAmount(amount: number, minimum = 0) {
  return Number.isInteger(amount) && amount >= minimum && amount <= maxAmount;
}

export function checkDebtPlan(input: DebtPlanDraft): DebtPlanDraft {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name || name.length > 100) throw new Error('Escribe un nombre de hasta 100 caracteres.');
  if ((input.kind !== 'card' && input.kind !== 'loan') || !isCurrency(input.currency))
    throw new Error('Tipo o moneda inválidos.');
  if (
    typeof input.statementAt !== 'string' ||
    typeof input.dueAt !== 'string' ||
    !parseDominicanDateTime(input.statementAt) ||
    !parseDominicanDateTime(input.dueAt) ||
    input.statementAt >= input.dueAt
  )
    throw new Error('El vencimiento debe ser posterior a la fecha y hora de corte.');
  if (
    !validAmount(input.principalMinor, 1) ||
    !validAmount(input.monthlyPaymentMinor, 1) ||
    !validAmount(input.extraMonthlyMinor) ||
    !validAmount(input.statementInterestMinor) ||
    !validAmount(input.chargesMinor)
  )
    throw new Error('Revisa el capital, la cuota y los demás importes.');
  if (
    !Number.isInteger(input.annualRateBasisPoints) ||
    input.annualRateBasisPoints < 0 ||
    input.annualRateBasisPoints > 100_000
  )
    throw new Error('Escribe una tasa anual entre 0 % y 1,000 %, con hasta dos decimales.');
  return { ...input, name };
}

export function validDebtPlans(value: unknown): value is DebtPlan[] {
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>();
  try {
    for (const plan of value as DebtPlan[]) {
      if (typeof plan.id !== 'string' || !plan.id || ids.has(plan.id)) return false;
      checkDebtPlan(plan);
      ids.add(plan.id);
    }
    return true;
  } catch {
    return false;
  }
}

type Installment = {
  paymentMinor: number;
  principalMinor: number;
};

type DebtScenario =
  | { status: 'first-payment-too-low' | 'interest-too-high' | 'beyond-horizon' }
  | {
      status: 'paid';
      months: number;
      payoffAt: string;
      interestMinor: number;
      totalMinor: number;
      first: Installment;
    };

function projectDebt(plan: DebtPlanDraft, monthlyMinor: number): DebtScenario {
  const firstFees = plan.statementInterestMinor + plan.chargesMinor;
  if (monthlyMinor < firstFees) return { status: 'first-payment-too-low' };

  let principal = plan.principalMinor;
  let interest = 0;
  let date = plan.dueAt.slice(0, 10);
  const time = plan.dueAt.slice(10);
  const anchor = Number(date.slice(8));
  const firstPrincipal = Math.min(principal, monthlyMinor - firstFees);
  const first = {
    paymentMinor: firstPrincipal + firstFees,
    principalMinor: firstPrincipal,
  };

  for (let month = 1; month <= maxDebtPlanMonths; month++) {
    const cycleInterest =
      month === 1
        ? plan.statementInterestMinor
        : monthlyInterestMinor(principal, plan.annualRateBasisPoints);
    if (month > 1 && monthlyMinor <= cycleInterest) return { status: 'interest-too-high' };
    const capital =
      month === 1 ? firstPrincipal : Math.min(principal, monthlyMinor - cycleInterest);
    principal -= capital;
    interest += cycleInterest;
    if (principal === 0) {
      return {
        status: 'paid',
        months: month,
        payoffAt: date + time,
        interestMinor: interest,
        totalMinor: plan.principalMinor + plan.chargesMinor + interest,
        first,
      };
    }
    if (month === maxDebtPlanMonths || date.startsWith('9999-12')) break;
    date = nextMonthlyDate(date, anchor);
  }
  return { status: 'beyond-horizon' };
}

export function compareDebtPlan(input: DebtPlanDraft) {
  const plan = checkDebtPlan(input);
  const base = projectDebt(plan, plan.monthlyPaymentMinor);
  const extra = plan.extraMonthlyMinor
    ? projectDebt(plan, plan.monthlyPaymentMinor + plan.extraMonthlyMinor)
    : null;
  const savings =
    base.status === 'paid' && extra?.status === 'paid'
      ? {
          months: base.months - extra.months,
          interestMinor: base.interestMinor - extra.interestMinor,
        }
      : null;
  return { base, extra, savings };
}
