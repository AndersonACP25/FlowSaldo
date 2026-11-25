import { parseDominicanDateTime } from './dateTime.ts';
import { monthlyInterestMinor } from './finance.ts';
import { isCurrency, type Currency } from './index.ts';
import { nextMonthlyDate } from './recurring.ts';

export const maxLoanInstallments = 600;
export const maxLoanRateBasisPoints = 100_000;

export type LoanSimulationInput = {
  principalMinor: number;
  currency: Currency;
  annualRateBasisPoints: number;
  installmentCount: number;
  firstDueAt: string;
  upfrontFeeMinor: number;
  monthlyInsuranceMinor: number;
};

function validMinor(amount: number) {
  return Number.isInteger(amount) && amount >= 0 && amount <= 2_147_483_647;
}

function calculateLoan(input: Omit<LoanSimulationInput, 'firstDueAt'>) {
  const {
    principalMinor,
    currency,
    annualRateBasisPoints,
    installmentCount,
    upfrontFeeMinor,
    monthlyInsuranceMinor,
  } = input;

  if (!isCurrency(currency) || !validMinor(principalMinor) || principalMinor === 0)
    throw new Error('Indica un monto positivo y una moneda válida.');
  if (
    !Number.isInteger(installmentCount) ||
    installmentCount < 1 ||
    installmentCount > maxLoanInstallments
  )
    throw new Error('Indica entre 1 y 600 cuotas mensuales.');
  if (principalMinor < installmentCount)
    throw new Error('El capital debe permitir asignar al menos un centavo a cada cuota.');
  if (
    !Number.isInteger(annualRateBasisPoints) ||
    annualRateBasisPoints < 0 ||
    annualRateBasisPoints > maxLoanRateBasisPoints
  )
    throw new Error('Indica una tasa anual entre 0 % y 1,000 %, con hasta dos decimales.');
  if (!validMinor(upfrontFeeMinor) || !validMinor(monthlyInsuranceMinor))
    throw new Error('Indica una comisión y un seguro de cero o más.');

  const monthlyRate = annualRateBasisPoints / 120_000;
  const basePayment = Math.round(
    monthlyRate
      ? (principalMinor * monthlyRate) / -Math.expm1(-installmentCount * Math.log1p(monthlyRate))
      : principalMinor / installmentCount,
  );

  let balance = principalMinor;
  let totalInterestMinor = 0;

  const schedule = Array.from({ length: installmentCount }, (_, index) => {
    const number = index + 1;
    const remainingInstallments = installmentCount - number;
    const interestMinor = monthlyInterestMinor(balance, annualRateBasisPoints);
    // Round each period in cents and reserve enough principal for all remaining installments.
    const paidPrincipalMinor = remainingInstallments
      ? Math.min(balance - remainingInstallments, Math.max(1, basePayment - interestMinor))
      : balance;
    balance -= paidPrincipalMinor;
    totalInterestMinor += interestMinor;
    return {
      number,
      principalMinor: paidPrincipalMinor,
      interestMinor,
      insuranceMinor: monthlyInsuranceMinor,
      paymentMinor: paidPrincipalMinor + interestMinor + monthlyInsuranceMinor,
      remainingMinor: balance,
    };
  });

  const totalInsuranceMinor = monthlyInsuranceMinor * installmentCount;
  return {
    currency,
    principalMinor,
    upfrontFeeMinor,
    totalInterestMinor,
    totalInsuranceMinor,
    totalCostMinor: totalInterestMinor + totalInsuranceMinor + upfrontFeeMinor,
    totalPaidMinor: principalMinor + totalInterestMinor + totalInsuranceMinor + upfrontFeeMinor,
    schedule,
  };
}

export function simulateLoan({ firstDueAt, ...input }: LoanSimulationInput) {
  if (typeof firstDueAt !== 'string' || (firstDueAt && !parseDominicanDateTime(firstDueAt)))
    throw new Error('Selecciona la fecha y hora del primer pago.');
  const result = calculateLoan(input);
  let date = firstDueAt.slice(0, 10);
  const time = firstDueAt.slice(10);
  const anchor = Number(date.slice(8));
  return {
    ...result,
    schedule: result.schedule.map((row, index) => {
      if (date && index > 0) date = nextMonthlyDate(date, anchor);
      return { ...row, dueAt: date ? date + time : null };
    }),
  };
}

export function compareLoanTerms(
  input: Omit<LoanSimulationInput, 'firstDueAt' | 'installmentCount'>,
) {
  const available = [12, 24, 36, 48, 60].filter((count) => count <= input.principalMinor);
  const terms = available.length ? available : [1];
  return terms.map((installmentCount) => {
    const estimate = calculateLoan({ ...input, installmentCount });
    return {
      installmentCount,
      firstPaymentMinor: estimate.schedule[0].paymentMinor,
      totalCostMinor: estimate.totalCostMinor,
      totalPaidMinor: estimate.totalPaidMinor,
    };
  });
}
