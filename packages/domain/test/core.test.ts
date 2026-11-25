import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatMinorAmount,
  ledgerBalance,
  parseSignedAmount,
  parseAmount,
  summarize,
  prepareRefund,
  refundBalance,
  categoryExpenses,
  checkMovementSplits,
  makeMonthlyClosing,
  pendingForClosing,
  validMonthlyClosings,
  setCommerceRule,
  suggestCommerceCategory,
  validCommerceRules,
  type CommerceRule,
  filterMovements,
  demoMovements,
  parseDemoMail,
  parseBankWithdrawal,
  upgradeCategories,
  demoCategoryCatalog,
  selectedCategory,
  budgetStatus,
  nextMonthlyDate,
  prepareOccurrence,
  projectAvailableCash,
  compareDebtPlan,
  simulateLoan,
  compareLoanTerms,
  type LoanSimulationInput,
  validDebtPlans,
  type DebtPlanDraft,
  addSavingsContribution,
  addPendingSettlement,
  pendingRemaining,
  validPendingItems,
  type PendingItem,
  savingsProgress,
  validSavingsGoals,
  type SavingsGoal,
  changeSince,
  previousMonth,
  movementsCsv,
  validateExportTable,
  movementExportHeaders,
  type RecurringTemplate,
} from '../src/index.ts';

test('CORE: monetary precision and input bounds', () => {
  assert.equal(formatMinorAmount(9007199254740982), '90,071,992,547,409.82');
  assert.equal(formatMinorAmount(-10029), '-100.29');
  assert.equal(parseSignedAmount('-100.29'), -10029);
  assert.equal(parseSignedAmount('0.00'), 0);
  assert.throws(() => parseSignedAmount('-21474836.48'));
  assert.equal(
    parseSignedAmount('90071992547409.91', Number.MAX_SAFE_INTEGER),
    Number.MAX_SAFE_INTEGER,
  );
  assert.throws(() => parseSignedAmount('90071992547409.92', Number.MAX_SAFE_INTEGER));
  assert.equal(parseAmount('100.29'), 10029);
  assert.equal(parseAmount('200,50'), 20050);
  for (const value of ['-1', '0', '1.001', '1,000.50', '21474836.48'])
    assert.throws(() => parseAmount(value));
});
test('CORE: totals isolate currencies/months and exclude own transfers', () => {
  const rows = filterMovements(demoMovements, { month: '2026-10', currency: 'DOP' });
  assert.deepEqual(summarize(rows, 'DOP'), {
    incomeMinor: 4500000,
    expenseMinor: 245050,
    differenceMinor: 4254950,
  });
  const euro = {
    ...demoMovements[0],
    currency: 'EUR',
    type: 'EXPENSE',
    amountMinor: 1299,
  } as const;
  const mixed = [...demoMovements, euro];
  assert.equal(summarize(mixed, 'USD').expenseMinor, 1299);
  assert.equal(summarize(mixed, 'EUR').expenseMinor, 1299);
  assert.equal(summarize(mixed, 'DOP').expenseMinor, 245050);
  assert.deepEqual(filterMovements(mixed, { month: '2026-10', currency: 'EUR' }), [euro]);
  // Payment transfers reduce source cash and debt equally; no new expense.
  assert.equal(ledgerBalance(100000, 0, 25000, 0), 75000);
  assert.equal(ledgerBalance(-50000, 0, 0, 25000), -25000);
  assert.equal(ledgerBalance(0, 10029, 0, 0), 10029);
  assert.throws(() => ledgerBalance(Number.MAX_SAFE_INTEGER, 1, 0, 0));
  assert.equal(filterMovements(rows, { month: '2026-09', currency: 'DOP' }).length, 0);
});
test('CORE: only explicit valid synthetic messages become movements', () => {
  assert.equal(
    parseDemoMail('FLOWSALDO-DEMO|EXPENSE|DOP|12.50|2026-10-21|Compra').status,
    'PARSED',
  );
  const euro = parseDemoMail('FLOWSALDO-DEMO|EXPENSE|EUR|12.50|2026-10-21|Compra');
  assert.equal(euro.status, 'PARSED');
  if (euro.status === 'PARSED') assert.equal(euro.movement.currency, 'EUR');
  for (const body of [
    'desconocido',
    'FLOWSALDO-DEMO|EXPENSE|GBP|12.50|2026-10-21|Compra',
    'FLOWSALDO-DEMO|EXPENSE|DOP|0.00|2026-10-21|Compra',
    'FLOWSALDO-DEMO|INCOME|USD|10.00|2026-02-30|Ingreso',
  ])
    assert.equal(parseDemoMail(body).status, 'REVIEW');
});
test('CORE: Dominican withdrawal suggestions validate money, date, approval and table shape', () => {
  const bhd = [
    'BHD Notificación de Transacciones',
    'Fecha\tMoneda\tMonto\tComercio\tEstado\tTipo',
    '04/08/2025 10:21 am\tRD\t$1,234.56\tCAJERO DE PRUEBA\tAprobada\tRetiro de Efectivo',
  ].join('\n');
  const popular = [
    'Monto\tMoneda\tFecha\tCajero Automatico\tEstatus',
    'RD$2,345.67\tPeso dominicano\t06/07/2025\tATM DE PRUEBA\tAprobada',
  ].join('\n');
  for (const [body, version, amount, date] of [
    [bhd, 'bhd-withdrawal-v1', 123456, '2025-08-04'],
    [popular, 'popular-withdrawal-v1', 234567, '2025-07-06'],
  ] as const) {
    const result = parseBankWithdrawal(body);
    assert.equal(result?.parserVersion, version);
    assert.equal(result.movement.amountMinor, amount);
    assert.equal(result.movement.currency, 'DOP');
    assert.equal(result.movement.occurredAt.slice(0, 10), date);
    assert.equal(result.movement.type, 'EXPENSE');
  }
  for (const body of [
    bhd.replace('Aprobada', 'Declinada'),
    bhd.replace('Retiro de Efectivo', 'Compra'),
    bhd.replace('1,234.56', '12,34.56'),
    popular.replace('06/07', '31/02'),
    popular.replace('Peso dominicano', 'USD'),
    popular + '\n' + popular.split('\n')[1],
    'PayPal: pago recibido',
    'Banco extranjero: retiro',
  ]) {
    assert.equal(parseBankWithdrawal(body), null);
  }
});
test('CORE: category migration/archive preserves history and prevents new assignment', () => {
  const data = upgradeCategories(demoMovements);
  const category = data.categories.find((c) => c.name === 'Alimentación')!;
  const catalog = data.categories.map((c) =>
    c.id === category.id ? { ...c, name: 'Comida', normalizedName: 'comida', archived: true } : c,
  );
  const migrated = upgradeCategories(data.movements, catalog);
  assert.deepEqual(migrated.movements, data.movements);
  assert.equal(migrated.movements[1].category, 'Alimentación');
  assert.throws(() => selectedCategory(catalog, category.id, 'Comida'));
  assert.equal(
    selectedCategory(catalog, category.id, 'Comida', migrated.movements[1]).category,
    'Alimentación',
  );
  assert.deepEqual(upgradeCategories(migrated.movements, catalog), migrated);
});
test('CORE: budget alerts respect exact 80/100 thresholds and excess', () => {
  assert.equal(budgetStatus(7999, 10000).state, 'normal');
  assert.equal(budgetStatus(8000, 10000).state, 'warning');
  assert.equal(budgetStatus(9999, 10000).state, 'warning');
  assert.equal(budgetStatus(10000, 10000).state, 'exceeded');
  assert.equal(budgetStatus(12501, 10000).excessMinor, 2501);
  assert.equal(budgetStatus(0, 10000).availableMinor, 10000);
  assert.throws(() => budgetStatus(0, 0));
});
test('CORE: monthly recurrence keeps anchor through leap/short months and year boundaries', () => {
  assert.equal(nextMonthlyDate('2027-01-31', 31), '2027-02-28');
  assert.equal(nextMonthlyDate('2027-02-28', 31), '2027-03-31');
  assert.equal(nextMonthlyDate('2028-01-31', 31), '2028-02-29');
  assert.equal(nextMonthlyDate('2026-12-15', 15), '2027-01-15');
  assert.throws(() => nextMonthlyDate('2026-02-30', 30));
});
test('CORE: recurrence requires due/active/unconfirmed occurrence before posting', () => {
  const t: RecurringTemplate = {
    id: 'rent',
    version: 0,
    description: 'Alquiler',
    amountMinor: 10000,
    currency: 'DOP',
    type: 'EXPENSE',
    category: 'Servicios',
    categoryId: 'services',
    startDate: '2026-01-31',
    nextDate: '2026-01-31',
    anchorDay: 31,
    active: true,
  };
  const prepared = prepareOccurrence(t, t.nextDate, '2026-02-01');
  assert.equal(prepared.nextDate, '2026-02-28');
  assert.equal(prepared.movement.amountMinor, 10000);
  const timed = { ...t, timeOfDay: '23:50' };
  assert.equal(prepared.movement.occurredAt, '2026-01-31T12:00:00.000Z');
  assert.throws(() => prepareOccurrence(timed, t.nextDate, '2026-02-01T03:49:59Z'));
  const timedMovement = prepareOccurrence(timed, t.nextDate, '2026-02-01T03:50:00Z');
  assert.equal(timedMovement.movement.occurredAt, '2026-02-01T03:50:00.000Z');
  assert.equal(timedMovement.nextDate, '2026-02-28');
  assert.throws(() => prepareOccurrence(t, t.nextDate, '2026-01-30'));
  assert.equal(prepareOccurrence(t, t.nextDate, '2026-01-30', [], false).nextDate, '2026-02-28');
  assert.throws(() => prepareOccurrence({ ...t, active: false }, t.nextDate, '2026-02-01'));
  assert.throws(() =>
    prepareOccurrence(t, t.nextDate, '2026-02-01', [
      { templateId: t.id, scheduledFor: t.nextDate, movementId: null },
    ]),
  );
  assert.throws(() =>
    prepareOccurrence({ ...t, nextDate: prepared.nextDate }, t.nextDate, '2026-02-01'),
  );
});
test('CORE: cash projection counts pending installments by currency and exact cutoff', () => {
  const rent: RecurringTemplate = {
    id: 'rent',
    version: 1,
    description: 'Alquiler',
    amountMinor: 600_000,
    currency: 'DOP',
    type: 'EXPENSE',
    categoryId: 'services',
    category: 'Servicios',
    startDate: '2026-01-31',
    nextDate: '2026-01-31',
    anchorDay: 31,
    timeOfDay: '09:00',
    active: true,
  };
  const input = {
    currency: 'DOP',
    balanceMinor: 2_000_000,
    nextIncomeAt: '2026-03-31T09:00',
    now: new Date('2026-02-28T14:00:00Z'),
    templates: [
      rent,
      { ...rent, id: 'paused', active: false },
      { ...rent, id: 'foreign', currency: 'USD' },
      { ...rent, id: 'transfer', type: 'TRANSFER' },
      { ...rent, id: 'income', type: 'INCOME' },
    ],
  } satisfies Parameters<typeof projectAvailableCash>[0];
  const result = projectAvailableCash(input);
  assert.equal(result.commitments.length, 1);
  assert.equal(result.commitments[0].occurrences, 2);
  assert.equal(result.committedMinor, 1_200_000);
  assert.equal(result.availableMinor, 800_000);
  assert.equal(
    projectAvailableCash({ ...input, nextIncomeAt: '2026-03-31T09:01' }).availableMinor,
    200_000,
  );
  assert.equal(
    projectAvailableCash({ ...input, balanceMinor: 100_000 }).availableMinor,
    -1_100_000,
  );
  const tracked = {
    id: 'tracked-rent',
    name: 'Alquiler pendiente',
    kind: 'pay' as const,
    currency: 'DOP' as const,
    dueAt: '2026-01-31T09:00',
    occurrence: { templateId: rent.id, scheduledFor: rent.nextDate },
    remainingMinor: 400_000,
  };
  const reconciled = projectAvailableCash({
    ...input,
    pending: [
      tracked,
      { ...tracked, id: 'receivable', kind: 'collect', occurrence: undefined },
      { ...tracked, id: 'other-currency', currency: 'EUR', occurrence: undefined },
      { ...tracked, id: 'next-cycle', dueAt: input.nextIncomeAt, occurrence: undefined },
    ],
  });
  assert.equal(reconciled.committedMinor, 1_000_000);
  assert.equal(reconciled.commitments[1].firstDueAt, '2026-02-28T09:00');
  assert.equal(
    projectAvailableCash({ ...input, pending: [{ ...tracked, remainingMinor: 0 }] }).committedMinor,
    600_000,
  );
  const legacy = { ...rent, nextDate: '2026-03-31', timeOfDay: null };
  assert.equal(
    projectAvailableCash({ ...input, templates: [legacy], nextIncomeAt: '2026-03-31T08:00' })
      .committedMinor,
    0,
  );
  assert.throws(
    () => projectAvailableCash({ ...input, nextIncomeAt: '2026-02-28T10:00' }),
    /futuro/,
  );
});
test('CORE: categorized parts sum to one expense and filter by the actual categories', () => {
  const date = '2026-11-25T12:00:00.000Z';
  const parts = [
    { categoryId: 'food', category: 'Alimentación', amountMinor: 70_020 },
    { categoryId: 'health', category: 'Salud', amountMinor: 30_009 },
  ];
  const movement = {
    ...demoMovements[0],
    categoryId: 'old',
    type: 'EXPENSE' as const,
    currency: 'DOP' as const,
    occurredAt: date,
    amountMinor: 100_029,
    splits: parts,
  };
  checkMovementSplits(movement.type, movement.amountMinor, parts);
  assert.equal(summarize([movement], 'DOP').expenseMinor, 100_029);
  assert.deepEqual(categoryExpenses([movement]), [
    { category: 'Alimentación', amountMinor: 70_020 },
    { category: 'Salud', amountMinor: 30_009 },
  ]);
  const filter = { currency: 'DOP' as const, month: '2026-11' };
  assert.deepEqual(filterMovements([movement], { ...filter, categoryId: 'health' }), [movement]);
  assert.deepEqual(filterMovements([movement], { ...filter, categoryId: 'old' }), []);
  assert.match(movementsCsv([movement]), /"1000.29".*"Gasto dividido"/);
  assert.equal(movementsCsv([movement]).split('\r\n').length, 2);
  assert.throws(() => checkMovementSplits('TRANSFER', 100_029, parts), /Solo puedes dividir/);
  assert.throws(() => checkMovementSplits('EXPENSE', 100_028, parts), /deben sumar/);
  assert.throws(
    () => checkMovementSplits('EXPENSE', 140_040, [parts[0], parts[0]]),
    /categoría distinta/,
  );
});
test('CORE: repeated refunds conserve cents and reduce expenses in the posting month', () => {
  const source = {
    ...demoMovements[1],
    type: 'EXPENSE' as const,
    currency: 'DOP' as const,
    occurredAt: '2026-10-30T12:00:00.000Z',
    amountMinor: 10_001,
    splits: [
      { categoryId: 'food', category: 'Alimentación', amountMinor: 6_000 },
      { categoryId: 'transport', category: 'Transporte', amountMinor: 4_001 },
    ],
  };
  const occurredAt = '2026-11-02T12:00:00.000Z';
  const partial = {
    ...prepareRefund(source, [], { amountMinor: 5_000, occurredAt }),
    id: 'refund-a',
    description: 'Devolución parcial',
  };
  assert.equal(partial.splits.find((item) => item.categoryId === 'food')?.amountMinor, 3_000);
  assert.equal(refundBalance(source, [partial]).remainingMinor, 5_001);
  const last = {
    ...prepareRefund(source, [partial], { amountMinor: 5_001, occurredAt }),
    id: 'refund-b',
    description: 'Devolución restante',
  };
  assert.equal(refundBalance(source, [partial, last]).remainingMinor, 0);
  assert.throws(
    () => prepareRefund(source, [partial, last], { amountMinor: 1, occurredAt }),
    /supera/,
  );
  assert.throws(
    () => prepareRefund(source, [], { amountMinor: 1, occurredAt: '2026-10-29T12:00:00Z' }),
    /fecha/,
  );
  assert.deepEqual(summarize([partial], 'DOP'), {
    incomeMinor: 0,
    expenseMinor: -5_000,
    differenceMinor: 5_000,
  });
  assert.deepEqual(categoryExpenses([partial]), [
    { category: 'Transporte', amountMinor: -2_000 },
    { category: 'Alimentación', amountMinor: -3_000 },
  ]);
  assert.equal(budgetStatus(-3_000, 10_000).availableMinor, 13_000);
  assert.equal(changeSince(5_000, -5_000).percentage, null);
});
test('CORE: partial settlements use the live movement exactly once and preserve currency', () => {
  const item: PendingItem = {
    id: 'electricity',
    name: 'Electricidad',
    amountMinor: 100_000,
    currency: 'DOP',
    kind: 'pay',
    dueAt: '2026-11-24T15:00',
    settlements: [],
  };
  const other: PendingItem = { ...item, id: 'other' };
  const expense = {
    ...demoMovements[0],
    currency: 'DOP' as const,
    type: 'EXPENSE' as const,
    amountMinor: 60_000,
  };
  const movements = new Map([[expense.id, expense]]);
  const link = { id: 'link', kind: 'movement' as const, movementId: expense.id };
  const withPartial = addPendingSettlement(
    [item, other],
    item.id,
    { id: 'manual', kind: 'manual', amountMinor: 40_000 },
    movements,
  );
  assert.equal(pendingRemaining(withPartial[0], movements), 60_000);
  assert.throws(
    () =>
      addPendingSettlement(
        withPartial,
        item.id,
        { id: 'extra', kind: 'manual', amountMinor: 60_001 },
        movements,
      ),
    /excede/,
  );
  assert.throws(
    () => addPendingSettlement([{ ...item, currency: 'EUR' }], item.id, link, movements),
    /moneda/,
  );
  assert.throws(
    () => addPendingSettlement([{ ...item, kind: 'collect' }], item.id, link, movements),
    /tipo/,
  );
  const settled = addPendingSettlement(withPartial, item.id, link, movements);
  assert.equal(pendingRemaining(settled[0], movements), 0);
  assert.equal(pendingRemaining(settled[0], new Map()), 60_000);
  assert.throws(
    () => addPendingSettlement(settled, other.id, link, movements),
    /ya está vinculado/,
  );
  assert.ok(validPendingItems(settled));
  assert.equal(validPendingItems([settled[0], { ...other, settlements: [link] }]), false);
});
test('CORE: commerce suggestions prefer specific matches and avoid unsafe category guesses', () => {
  const catalog = demoCategoryCatalog([]);
  const food = catalog.find((item) => item.name === 'Alimentación')!;
  const leisure = catalog.find((item) => item.name === 'Ocio')!;
  const transport = catalog.find((item) => item.name === 'Transporte')!;
  const rule: CommerceRule = { id: 'cafe', pattern: 'Café', match: 'phrase', categoryId: food.id };
  const specific = {
    ...rule,
    id: 'cafe-santo-domingo',
    pattern: 'Café Santo Domingo',
    categoryId: leisure.id,
  };
  const exact: CommerceRule = {
    ...specific,
    id: 'cafe-exact',
    match: 'exact',
    categoryId: transport.id,
  };
  const rules = [rule, specific, exact];
  assert.equal(
    suggestCommerceCategory('CAFE—Santo Domingo', rules, catalog)?.category.id,
    transport.id,
  );
  assert.equal(
    suggestCommerceCategory('Pago CAFe Santo Domingo RD', rules, catalog)?.category.id,
    leisure.id,
  );
  assert.equal(suggestCommerceCategory('Cafetería', rules, catalog), null);
  assert.equal(
    suggestCommerceCategory(
      'Café',
      rules,
      catalog.filter((item) => item.id !== food.id),
    ),
    null,
  );
  const archived = catalog.map((item) =>
    item.id === leisure.id ? { ...item, archived: true } : item,
  );
  assert.equal(
    suggestCommerceCategory('PAGO CAFÉ SANTO DOMINGO', rules, archived)?.category.id,
    food.id,
  );
  const conflicting = { ...rule, id: 'pago', pattern: 'Pago', categoryId: transport.id };
  assert.equal(suggestCommerceCategory('Pago Café', [rule, conflicting], catalog), null);
  const duplicate = { ...rule, id: 'dup', pattern: '  CAFE!' };
  assert.throws(() => setCommerceRule(rules, duplicate), /Ya existe/);
  assert.ok(!validCommerceRules([...rules, duplicate]));
  const edited = setCommerceRule(rules, { ...rule, categoryId: transport.id });
  assert.ok(validCommerceRules(edited));
  assert.equal(suggestCommerceCategory('Café', edited, catalog)?.category.id, transport.id);
});
test('CORE: monthly closings preserve the budget and unpaid amounts by due month and currency', () => {
  const bill: PendingItem = {
    id: 'bill',
    name: 'Electricidad',
    amountMinor: 100_029,
    currency: 'DOP',
    kind: 'pay',
    dueAt: '2026-11-30T23:59',
    settlements: [{ id: 'linked', kind: 'movement', movementId: 'payment' }],
  };
  const items: PendingItem[] = [
    bill,
    { ...bill, id: 'euro', currency: 'EUR', settlements: [] },
    { ...bill, id: 'december', dueAt: '2026-12-01T00:00', settlements: [] },
    { ...bill, id: 'invoice', kind: 'collect', settlements: [] },
    {
      ...bill,
      id: 'settled',
      settlements: [{ id: 'manual', kind: 'manual', amountMinor: 100_029 }],
    },
  ];
  const payment = {
    ...demoMovements[0],
    id: 'payment',
    type: 'EXPENSE' as const,
    currency: 'DOP' as const,
    amountMinor: 70_020,
  };
  const pending = pendingForClosing(items, new Map([[payment.id, payment]]), '2026-11', 'DOP');
  assert.deepEqual(
    pending.map((item) => item.id),
    ['bill', 'invoice'],
  );
  const snapshot = makeMonthlyClosing(
    {
      month: '2026-11',
      currency: 'DOP',
      capturedAt: '2026-12-01T04:30:00Z',
      incomeMinor: 150_012,
      expenseMinor: 70_020,
      uncategorizedCount: 1,
      budgetMinor: 60_000,
      categories: [{ categoryId: 'c1', name: 'Servicios', limitMinor: 80_000, spentMinor: 70_020 }],
    },
    pending,
  );
  assert.equal(snapshot.toPayMinor, 30_009);
  assert.equal(snapshot.toCollectMinor, 100_029);
  assert.equal(snapshot.pendingCount, 2);
  assert.equal(snapshot.budgetMinor, 60_000);
  assert.ok(validMonthlyClosings([snapshot, { ...snapshot, currency: 'EUR' }]));
  assert.ok(!validMonthlyClosings([snapshot, snapshot]));
  assert.ok(!validMonthlyClosings([{ ...snapshot, expenseMinor: -1 }]));
});
test('CORE: loan installments reconcile interest, principal and separate fees in cents', () => {
  const input: LoanSimulationInput = {
    principalMinor: 10_000_000,
    currency: 'DOP',
    annualRateBasisPoints: 1800,
    installmentCount: 12,
    firstDueAt: '2028-01-31T17:30',
    upfrontFeeMinor: 100_000,
    monthlyInsuranceMinor: 25_000,
  };
  const loan = simulateLoan(input);
  assert.deepEqual(loan.schedule[0], {
    number: 1,
    dueAt: '2028-01-31T17:30',
    principalMinor: 766_800,
    interestMinor: 150_000,
    insuranceMinor: 25_000,
    paymentMinor: 941_800,
    remainingMinor: 9_233_200,
  });
  assert.equal(loan.schedule[1].dueAt, '2028-02-29T17:30');
  assert.equal(loan.schedule[2].dueAt, '2028-03-31T17:30');
  assert.equal(loan.schedule.at(-1)?.paymentMinor, 941_799);
  assert.equal(loan.schedule.at(-1)?.remainingMinor, 0);
  assert.equal(loan.totalInterestMinor, 1_001_599);
  assert.equal(loan.totalCostMinor, 1_401_599);
  assert.equal(loan.totalPaidMinor, 11_401_599);
  const scenarios = compareLoanTerms(input);
  assert.deepEqual(
    scenarios.map((row) => row.installmentCount),
    [12, 24, 36, 48, 60],
  );
  assert.equal(scenarios[0].totalPaidMinor, loan.totalPaidMinor);
  assert.equal(scenarios[0].firstPaymentMinor, loan.schedule[0].paymentMinor);
  assert.ok(scenarios[4].firstPaymentMinor < scenarios[0].firstPaymentMinor);
  assert.ok(scenarios[4].totalCostMinor > scenarios[0].totalCostMinor);
  assert.equal(simulateLoan({ ...input, firstDueAt: '' }).schedule[0].dueAt, null);
  assert.equal(
    loan.schedule.reduce((total, item) => total + item.paymentMinor, loan.upfrontFeeMinor),
    loan.totalPaidMinor,
  );
  const zeroRate = simulateLoan({
    ...input,
    principalMinor: 5,
    annualRateBasisPoints: 0,
    installmentCount: 4,
    upfrontFeeMinor: 0,
    monthlyInsuranceMinor: 0,
  });
  assert.deepEqual(
    zeroRate.schedule.map((item) => item.paymentMinor),
    [1, 1, 1, 2],
  );
  assert.equal(zeroRate.totalPaidMinor, 5);
  assert.throws(() => simulateLoan({ ...input, installmentCount: 0 }), /cuotas/);
  assert.throws(() => simulateLoan({ ...input, principalMinor: 1 }), /centavo/);
  assert.throws(() => simulateLoan({ ...input, annualRateBasisPoints: -1 }), /tasa/);
  assert.throws(() => simulateLoan({ ...input, monthlyInsuranceMinor: -1 }), /seguro/);
  assert.throws(() => simulateLoan({ ...input, firstDueAt: '2026-02-30T12:00' }), /primer pago/);
});
test('CORE: debt scenarios preserve cents, first-cycle costs and the monthly due day', () => {
  const plan: DebtPlanDraft = {
    name: 'Tarjeta CORE',
    kind: 'card',
    currency: 'DOP',
    statementAt: '2026-01-10T08:00',
    dueAt: '2026-01-31T16:00',
    principalMinor: 1_000_000,
    statementInterestMinor: 25_000,
    chargesMinor: 10_000,
    annualRateBasisPoints: 2400,
    monthlyPaymentMinor: 300_000,
    extraMonthlyMinor: 100_000,
  };
  const result = compareDebtPlan(plan);
  assert.deepEqual(result.base, {
    status: 'paid',
    months: 4,
    payoffAt: '2026-04-30T16:00',
    interestMinor: 51_868,
    totalMinor: 1_061_868,
    first: { paymentMinor: 300_000, principalMinor: 265_000 },
  });
  assert.equal(result.extra?.status === 'paid' && result.extra.payoffAt, '2026-03-31T16:00');
  assert.deepEqual(result.savings, { months: 1, interestMinor: 9_214 });
  const payOffNow = compareDebtPlan({ ...plan, monthlyPaymentMinor: 1_200_000 });
  assert.equal(payOffNow.base.status === 'paid' && payOffNow.base.totalMinor, 1_035_000);
  assert.deepEqual(compareDebtPlan({ ...plan, monthlyPaymentMinor: 34_999 }).base, {
    status: 'first-payment-too-low',
  });
  const noAmortization = compareDebtPlan({
    ...plan,
    statementInterestMinor: 0,
    chargesMinor: 0,
    monthlyPaymentMinor: 15_000,
  });
  assert.deepEqual(noAmortization.base, { status: 'interest-too-high' });
  assert.equal(noAmortization.extra?.status, 'paid');
  assert.equal(noAmortization.savings, null);
  const longPlan = {
    ...plan,
    annualRateBasisPoints: 0,
    statementInterestMinor: 0,
    chargesMinor: 0,
    monthlyPaymentMinor: 1,
    extraMonthlyMinor: 0,
  };
  assert.deepEqual(compareDebtPlan(longPlan).base, { status: 'beyond-horizon' });
  assert.equal(compareDebtPlan(longPlan).extra, null);
  assert.throws(() => compareDebtPlan({ ...plan, dueAt: plan.statementAt }), /vencimiento/);
  assert.throws(() => compareDebtPlan({ ...plan, annualRateBasisPoints: 100_001 }), /tasa anual/);
  assert.ok(validDebtPlans([{ ...plan, id: 'saved' }]));
  assert.equal(
    validDebtPlans([
      { ...plan, id: 'saved' },
      { ...plan, id: 'saved' },
    ]),
    false,
  );
});
test('CORE: goal contributions preserve currency and reuse each transfer only once', () => {
  const goal: SavingsGoal = {
    id: 'emergency',
    name: 'Emergencia',
    currency: 'DOP',
    targetMinor: 100_000,
    contributions: [{ id: 'manual-1', kind: 'manual', amountMinor: 25_000 }],
  };
  const other = { ...goal, id: 'laptop', contributions: [] };
  const transfer = {
    ...demoMovements[0],
    id: 'saving-transfer',
    type: 'TRANSFER',
    currency: 'DOP',
    amountMinor: 25_000,
  } as const;
  const transfers = new Map([[transfer.id, transfer]]);
  const link = { id: 'transfer-1', kind: 'transfer', movementId: transfer.id } as const;
  const goals = addSavingsContribution([goal, other], goal.id, link, transfers);
  assert.deepEqual(savingsProgress(goals[0], transfers), {
    savedMinor: 50_000,
    remainingMinor: 50_000,
    percent: 50,
  });
  assert.deepEqual(summarize([transfer], 'DOP'), {
    incomeMinor: 0,
    expenseMinor: 0,
    differenceMinor: 0,
  });
  assert.throws(
    () => addSavingsContribution(goals, other.id, link, transfers),
    /ya está vinculada/,
  );
  assert.throws(
    () => addSavingsContribution([{ ...goal, currency: 'EUR' }], goal.id, link, transfers),
    /moneda de la meta/,
  );
  assert.equal(validSavingsGoals(goals), true);
  assert.equal(validSavingsGoals([goals[0], { ...other, contributions: [link] }]), false);
  assert.equal(savingsProgress(goals[0], new Map()).savedMinor, 25_000);
  assert.equal(
    savingsProgress(goals[0], new Map([[transfer.id, { ...transfer, amountMinor: 35_000 }]]))
      .percent,
    60,
  );
});
test('CORE: monthly comparison handles zero baselines and year rollover', () => {
  assert.deepEqual(changeSince(10000, 0), {
    previousMinor: 0,
    deltaMinor: 10000,
    percentage: null,
  });
  assert.equal(changeSince(0, 0).percentage, 0);
  assert.equal(changeSince(8000, 10000).percentage, -20);
  assert.equal(previousMonth('2027-01'), '2026-12');
});
test('CORE: CSV preserves values/columns and neutralizes spreadsheet formulas', () => {
  const csv = movementsCsv([
    { ...demoMovements[0], description: '=SUM(1,2)', category: 'A "B"\nC' },
  ]);
  assert.ok(csv.includes('"\'=SUM(1,2)"'));
  assert.ok(csv.includes('"A ""B""\nC"'));
  assert.ok(csv.includes('45000.00'));
  validateExportTable(movementExportHeaders, [[1, 2, 3, 4, 5, 6]]);
  assert.throws(() => validateExportTable(['Fecha', 'Monto'], [['a;b']]));
});
