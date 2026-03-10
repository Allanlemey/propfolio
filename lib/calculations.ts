// lib/calculations.ts
// Shared calculation engine for Propfolio
// Used by: dashboard, property detail, property list, simulation

// ── Types ─────────────────────────────────────────────────────

export type Property = {
  id: string;
  name: string;
  address: string | null;
  type: string;
  surface: number | null;
  purchase_price: number;
  purchase_date: string | null;
  current_value: number;
  regime: string | null;
};

export type Loan = {
  id?: string;
  property_id?: string;
  amount?: number;
  rate?: number;
  duration_years?: number;
  monthly_payment: number;
  remaining_capital?: number;
};

export type Charge = {
  property_id?: string;
  type: string;
  amount: number;
  frequency: string;
};

export type Revenue = {
  property_id?: string;
  monthly_rent: number;
  vacancy_rate: number;
};

export type ScoreDetail = {
  rendement: number;
  cashflow: number;
  occupation: number;
  valorisation: number;
  emplacement: number;
  global: number;
};

export type CashflowLine = {
  label: string;
  amount: number;
  color: "green" | "red" | "yellow";
};

// ── Charge extraction ──────────────────────────────────────────

export function getChargeAmounts(charges: Charge[]) {
  let taxeFonciere = 0,
    copro = 0,
    pno = 0,
    gli = 0,
    travaux = 0;
  for (const c of charges) {
    const yearly = c.frequency === "monthly" ? c.amount * 12 : c.amount;
    if (c.type === "taxe_fonciere") taxeFonciere = yearly;
    else if (c.type === "copro") copro = yearly;
    else if (c.type === "pno") pno = yearly;
    else if (c.type === "gli") gli = yearly;
    else if (c.type === "travaux") travaux = yearly;
  }
  return { taxeFonciere, copro, pno, gli, travaux };
}

// ── Tax calculation ────────────────────────────────────────────

/**
 * Low-level tax function — takes explicit numeric params.
 * Used by the simulation page (raw slider values).
 */
export function calcMonthlyTax(
  regime: string | null,
  annualRent: number,
  annualCharges: number,
  annualInterest: number,
  amortissement: number
): number {
  const TMI = 0.3;
  const PS = 0.172;
  switch (regime) {
    case "LMNP micro-BIC":
      return (annualRent * 0.5 * (TMI + PS)) / 12;
    case "LMNP réel": {
      const taxable = Math.max(0, annualRent - annualCharges - amortissement);
      return (taxable * PS) / 12;
    }
    case "Nu micro-foncier":
      return (annualRent * 0.7 * (TMI + PS)) / 12;
    case "Nu réel": {
      const taxable = Math.max(0, annualRent - annualCharges - annualInterest);
      return (taxable * (TMI + PS)) / 12;
    }
    default:
      return (annualRent * 0.5 * (TMI + PS)) / 12;
  }
}

/**
 * High-level tax function — derives interest and amortissement from Loan object.
 * Used by detail page and dashboard (Supabase-shaped objects).
 */
export function computeMonthlyTax(
  regime: string | null,
  annualRent: number,
  annualChargesTotal: number,
  loan: Loan | null,
  purchasePrice: number
): number {
  const annualInterest =
    loan?.remaining_capital != null && loan?.rate != null
      ? loan.remaining_capital * (loan.rate / 100)
      : 0;
  const amortissement = purchasePrice * 0.025;
  return calcMonthlyTax(
    regime,
    annualRent,
    annualChargesTotal,
    annualInterest,
    amortissement
  );
}

// ── Cashflow ───────────────────────────────────────────────────

export function computeCashflowLines(
  property: Property,
  loan: Loan | null,
  charges: Charge[],
  revenue: Revenue | null
): { lines: CashflowLine[]; total: number } {
  const monthlyRent = revenue?.monthly_rent ?? 0;
  const { taxeFonciere, copro, pno, gli, travaux } = getChargeAmounts(charges);
  const annualRent = monthlyRent * 12;
  const annualChargesTotal = taxeFonciere + copro + pno + gli + travaux;
  const monthlyTax = computeMonthlyTax(
    property.regime,
    annualRent,
    annualChargesTotal,
    loan,
    property.purchase_price
  );
  const provisionVacance = monthlyRent * 0.04;
  const monthlyPayment = loan?.monthly_payment ?? 0;

  const lines: CashflowLine[] = [
    { label: "Loyer CC", amount: monthlyRent, color: "green" },
    ...(monthlyPayment > 0
      ? [
          {
            label: "Mensualité crédit",
            amount: -monthlyPayment,
            color: "red" as const,
          },
        ]
      : []),
    ...(taxeFonciere > 0
      ? [
          {
            label: "Taxe foncière (÷12)",
            amount: -(taxeFonciere / 12),
            color: "red" as const,
          },
        ]
      : []),
    ...(copro > 0
      ? [{ label: "Copropriété", amount: -(copro / 12), color: "red" as const }]
      : []),
    ...(pno > 0
      ? [
          {
            label: "Assurance PNO",
            amount: -(pno / 12),
            color: "red" as const,
          },
        ]
      : []),
    ...(gli > 0
      ? [
          {
            label: "Assurance GLI",
            amount: -(gli / 12),
            color: "red" as const,
          },
        ]
      : []),
    { label: "Provision vacance (4 %)", amount: -provisionVacance, color: "red" },
    ...(travaux > 0
      ? [
          {
            label: "Provision travaux",
            amount: -(travaux / 12),
            color: "red" as const,
          },
        ]
      : []),
    {
      label: `Impôt (${property.regime ?? "LMNP µ-BIC"})`,
      amount: -monthlyTax,
      color: "yellow",
    },
  ];

  const total = lines.reduce((s, l) => s + l.amount, 0);
  return { lines, total };
}

/** Convenience wrapper — returns only the net cashflow total. */
export function computeNetCashflow(
  property: Property,
  loan: Loan | null,
  charges: Charge[],
  revenue: Revenue | null
): number {
  return computeCashflowLines(property, loan, charges, revenue).total;
}

// ── Score ──────────────────────────────────────────────────────

export function computeScoreDetails(
  property: Property,
  loan: Loan | null,
  charges: Charge[],
  revenue: Revenue | null
): ScoreDetail {
  const monthlyRent = revenue?.monthly_rent ?? 0;
  const { taxeFonciere, copro, pno, gli, travaux } = getChargeAmounts(charges);
  const annualCharges =
    taxeFonciere +
    copro +
    pno +
    gli +
    travaux +
    (loan?.monthly_payment ?? 0) * 12;
  const rendementNet =
    property.purchase_price > 0
      ? ((monthlyRent * 12 - annualCharges) / property.purchase_price) * 100
      : 0;

  const cashflowNet = computeNetCashflow(property, loan, charges, revenue);

  const plusValuePct =
    property.purchase_price > 0
      ? ((property.current_value - property.purchase_price) /
          property.purchase_price) *
        100
      : 0;

  const rendementScore =
    rendementNet > 6 ? 90 : rendementNet > 4 ? 70 : rendementNet > 2 ? 50 : 30;
  const cashflowScore =
    cashflowNet > 150 ? 90 : cashflowNet > 50 ? 70 : cashflowNet > 0 ? 55 : 30;
  const occupationScore = 95;
  const valorisationScore =
    plusValuePct > 10 ? 85 : plusValuePct > 5 ? 65 : plusValuePct > 0 ? 50 : 30;
  const emplacementScore = 70;

  const global = Math.round(
    rendementScore * 0.25 +
      cashflowScore * 0.25 +
      occupationScore * 0.2 +
      valorisationScore * 0.15 +
      emplacementScore * 0.15
  );

  return {
    rendement: rendementScore,
    cashflow: cashflowScore,
    occupation: occupationScore,
    valorisation: valorisationScore,
    emplacement: emplacementScore,
    global,
  };
}

// ── Loan amortization ──────────────────────────────────────────

/** Computes monthly payment from scratch (used by simulation). */
export function calcMonthlyPayment(
  principal: number,
  annualRate: number,
  years: number
): number {
  if (principal <= 0) return 0;
  const r = annualRate / 100 / 12;
  const n = years * 12;
  if (r === 0) return n > 0 ? principal / n : 0;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

/**
 * Remaining capital after yearsElapsed from initial principal.
 * Used by the simulation page (fresh amortization schedule).
 */
export function calcRemainingCapital(
  principal: number,
  annualRate: number,
  totalYears: number,
  yearsElapsed: number
): number {
  if (principal <= 0) return 0;
  const r = annualRate / 100 / 12;
  const n = totalYears * 12;
  const m = Math.min(yearsElapsed * 12, n);
  const mp = calcMonthlyPayment(principal, annualRate, totalYears);
  if (r === 0) return Math.max(0, principal - mp * m);
  const factor = Math.pow(1 + r, m);
  return Math.max(0, principal * factor - (mp * (factor - 1)) / r);
}

/**
 * Projects remaining capital N years forward from loan.remaining_capital.
 * Used by the dashboard 10-year projection KPI.
 */
export function projectRemainingCapital(loan: Loan, yearsFromNow: number): number {
  const R0 = loan.remaining_capital ?? 0;
  const mp = loan.monthly_payment;
  const r = (loan.rate ?? 0) / 100 / 12;
  const n = yearsFromNow * 12;
  if (r === 0) return Math.max(0, R0 - mp * n);
  const factor = Math.pow(1 + r, n);
  return Math.max(0, R0 * factor - (mp * (factor - 1)) / r);
}
