"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  getChargeAmounts,
  computeMonthlyTax,
  computeCashflowLines,
  computeScoreDetails,
} from "@/lib/calculations";
import type {
  Property,
  Loan,
  Charge,
  Revenue,
  ScoreDetail,
  CashflowLine,
} from "@/lib/calculations";

// ── Helpers ───────────────────────────────────────────────────

function fmt(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(Math.abs(n)));
}

const TYPE_LABEL: Record<string, string> = {
  appartement: "Appartement",
  maison: "Maison",
  studio: "Studio",
  immeuble: "Immeuble",
  commercial: "Local commercial",
};

function scoreColor(s: number) {
  if (s >= 75) return "#00D9A6";
  if (s >= 50) return "#6C63FF";
  if (s >= 30) return "#FBBF24";
  return "#FF6B6B";
}

function scoreStyle(s: number) {
  if (s >= 75) return { text: "text-green", bg: "bg-green/15" };
  if (s >= 50) return { text: "text-accent", bg: "bg-accent/15" };
  if (s >= 30) return { text: "text-[#FBBF24]", bg: "bg-[#FBBF24]/15" };
  return { text: "text-red", bg: "bg-red/15" };
}

function scoreSummary(score: number, cashflow: number): string {
  if (score >= 75) return "Excellent investissement. Cashflow solide et fort rendement.";
  if (score >= 60)
    return `Bon investissement. ${cashflow >= 0 ? "Cashflow positif" : "Cashflow légèrement négatif"} avec un rendement correct.`;
  if (score >= 50) return "Investissement correct. Quelques points d'amélioration possibles.";
  if (score >= 30) return "Investissement mitigé. Plusieurs critères à travailler.";
  return "Investissement difficile. Cashflow négatif ou rendement insuffisant.";
}

function getImprovements(scores: ScoreDetail): string[] {
  const tips = [
    {
      score: scores.rendement,
      tip: "Votre rendement est perfectible. Envisagez une légère révision du loyer ou une renégociation des charges de copropriété.",
    },
    {
      score: scores.cashflow,
      tip: "Le cashflow est limité ou négatif. Un remboursement anticipé partiel ou une renégociation du taux crédit peut inverser la tendance.",
    },
    {
      score: scores.valorisation,
      tip: "Le bien n'a pas encore pris de valeur. Des travaux d'amélioration (cuisine, salle de bain) peuvent valoriser significativement l'actif.",
    },
    {
      score: scores.occupation,
      tip: "Optimisez votre taux d'occupation via une gestion locative proactive ou un bail en colocation.",
    },
    {
      score: scores.emplacement,
      tip: "Suivez les projets urbains et les évolutions du quartier qui peuvent impacter positivement la valeur de revente.",
    },
  ];

  return tips
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .filter((t) => t.score < 80)
    .map((t) => t.tip);
}

// ── SVG Score Ring ────────────────────────────────────────────

function ScoreRing({ score, size = 100 }: { score: number; size?: number }) {
  const [animated, setAnimated] = useState(false);
  const r = size * 0.38;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - (animated ? score : 0) / 100);
  const color = scoreColor(score);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-label={`Score ${score}/100`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--border)"
        strokeWidth={size * 0.07}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={size * 0.07}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 1s ease-out" }}
      />
      <text
        x={size / 2}
        y={size / 2 - size * 0.04}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={color}
        fontSize={size * 0.2}
        fontWeight={700}
        fontFamily="Space Mono, monospace"
      >
        {score}
      </text>
      <text
        x={size / 2}
        y={size / 2 + size * 0.16}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="var(--text-secondary)"
        fontSize={size * 0.1}
        fontFamily="Space Mono, monospace"
      >
        /100
      </text>
    </svg>
  );
}

// ── Tab: Vue d'ensemble ───────────────────────────────────────

function TabOverview({
  property,
  loan,
}: {
  property: Property;
  loan: Loan | null;
}) {
  const plusValue = property.current_value - property.purchase_price;
  const plusValuePct =
    property.purchase_price > 0
      ? (plusValue / property.purchase_price) * 100
      : 0;

  const loanProgress =
    loan && (loan.amount ?? 0) > 0
      ? Math.round(
          (((loan.amount ?? 0) - (loan.remaining_capital ?? 0)) /
            (loan.amount ?? 0)) *
            100
        )
      : 0;

  type InfoRow = { label: string; value: string; valueClass?: string };

  const infoRows: InfoRow[] = [
    { label: "Type", value: TYPE_LABEL[property.type] ?? property.type },
    ...(property.address ? [{ label: "Adresse", value: property.address }] : []),
    ...(property.surface
      ? [{ label: "Surface", value: `${property.surface} m²` }]
      : []),
    ...(property.purchase_date
      ? [{ label: "Date d'achat", value: property.purchase_date }]
      : []),
    { label: "Prix d'achat", value: `${fmt(property.purchase_price)} €` },
    { label: "Valeur actuelle", value: `${fmt(property.current_value)} €` },
    {
      label: "Plus-value latente",
      value: `${plusValue >= 0 ? "+" : "−"}${fmt(plusValue)} € (${
        plusValuePct >= 0 ? "+" : ""
      }${plusValuePct.toFixed(1)} %)`,
      valueClass:
        plusValue >= 0
          ? "text-green font-semibold"
          : "text-red font-semibold",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Infos bien */}
      <div className="bg-card rounded-2xl p-4 border border-border space-y-3">
        <p className="text-sm font-semibold text-text">Informations du bien</p>
        {infoRows.map((row) => (
          <div
            key={row.label}
            className="flex justify-between items-start gap-4"
          >
            <span className="text-sm text-text-secondary shrink-0">
              {row.label}
            </span>
            <span
              className={`text-sm text-right font-mono ${
                row.valueClass ?? "text-text"
              }`}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>

      {/* Crédit */}
      {loan ? (
        <div className="bg-card rounded-2xl p-4 border border-border space-y-3">
          <p className="text-sm font-semibold text-text">Crédit immobilier</p>
          {[
            { label: "Montant initial", value: `${fmt(loan.amount ?? 0)} €` },
            { label: "Taux", value: `${loan.rate ?? 0} %` },
            { label: "Durée", value: `${loan.duration_years ?? 0} ans` },
            {
              label: "Mensualité",
              value: `${fmt(loan.monthly_payment)} €/mois`,
            },
            {
              label: "Capital restant dû",
              value: `${fmt(loan.remaining_capital ?? 0)} €`,
            },
          ].map((row) => (
            <div
              key={row.label}
              className="flex justify-between items-center"
            >
              <span className="text-sm text-text-secondary">{row.label}</span>
              <span className="text-sm font-mono text-text">{row.value}</span>
            </div>
          ))}

          <div>
            <div className="flex justify-between text-xs text-text-secondary mb-1.5">
              <span>Remboursement</span>
              <span className="font-semibold text-text">{loanProgress} %</span>
            </div>
            <div className="h-2 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-700"
                style={{ width: `${loanProgress}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex gap-3 p-4 bg-accent/5 border border-accent/20 rounded-2xl">
          <Info size={16} className="text-accent shrink-0 mt-0.5" />
          <p className="text-sm text-text-secondary">
            Achat comptant — aucun crédit associé à ce bien.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Tab: Cashflow ─────────────────────────────────────────────

function TabCashflow({
  lines,
  total,
}: {
  lines: CashflowLine[];
  total: number;
}) {
  const positive = total >= 0;

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-2xl p-4 border border-border">
        <p className="text-sm font-semibold text-text mb-4">
          Décomposition mensuelle
        </p>

        <div className="space-y-3">
          {lines.map((line, i) => {
            const amtPositive = line.amount >= 0;
            const colorClass =
              line.color === "green"
                ? "text-green"
                : line.color === "yellow"
                ? "text-[#FBBF24]"
                : "text-red";
            const dotClass =
              line.color === "green"
                ? "bg-green"
                : line.color === "yellow"
                ? "bg-[#FBBF24]"
                : "bg-red";

            return (
              <div
                key={i}
                className={`flex items-center justify-between ${
                  line.color === "yellow" ? "italic" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`}
                  />
                  <span className="text-sm text-text-secondary">
                    {line.label}
                  </span>
                </div>
                <span
                  className={`font-mono text-sm font-semibold ${colorClass}`}
                >
                  {amtPositive ? "+" : "−"}
                  {fmt(line.amount)} €
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t border-border">
          <div
            className={`rounded-xl p-4 ${
              positive
                ? "bg-green/10 border border-green/20"
                : "bg-red/10 border border-red/20"
            }`}
          >
            <p
              className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
                positive ? "text-green" : "text-red"
              }`}
            >
              Cashflow net réel
            </p>
            <p
              className={`font-mono font-bold text-2xl ${
                positive ? "text-green" : "text-red"
              }`}
            >
              {positive ? "+" : "−"}
              {fmt(total)} €
              <span className="text-sm font-normal ml-1 opacity-70">/mois</span>
            </p>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-text-secondary text-center px-2 leading-relaxed">
        Calculs indicatifs (TMI 30 % par défaut). Consultez un expert-comptable.
      </p>
    </div>
  );
}

// ── Tab: Score ────────────────────────────────────────────────

function TabScore({ scores }: { scores: ScoreDetail }) {
  const CRITERIA = [
    { key: "rendement" as const, label: "Rendement net", weight: 25 },
    { key: "cashflow" as const, label: "Cashflow", weight: 25 },
    { key: "occupation" as const, label: "Taux d'occupation", weight: 20 },
    { key: "valorisation" as const, label: "Valorisation", weight: 15 },
    { key: "emplacement" as const, label: "Emplacement", weight: 15 },
  ];

  const improvements = getImprovements(scores);

  return (
    <div className="space-y-4">
      {/* Big ring */}
      <div className="bg-card rounded-2xl p-6 border border-border flex flex-col items-center gap-3">
        <ScoreRing score={scores.global} size={140} />
        <p className="text-sm text-text-secondary text-center max-w-xs">
          {scoreSummary(
            scores.global,
            scores.cashflow > 55 ? 1 : -1
          )}
        </p>
      </div>

      {/* Criteria bars */}
      <div className="bg-card rounded-2xl p-4 border border-border space-y-4">
        <p className="text-sm font-semibold text-text">Détail par critère</p>
        {CRITERIA.map(({ key, label, weight }) => {
          const val = scores[key];
          const barColor =
            val >= 80
              ? "bg-green"
              : val >= 60
              ? "bg-accent"
              : val >= 40
              ? "bg-[#FBBF24]"
              : "bg-red";
          return (
            <div key={key}>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-text-secondary">
                  {label}{" "}
                  <span className="opacity-50">({weight} %)</span>
                </span>
                <span className="font-mono font-bold text-text">{val}</span>
              </div>
              <div className="h-2 bg-border rounded-full overflow-hidden">
                <div
                  className={`h-full ${barColor} rounded-full transition-all duration-700`}
                  style={{ width: `${val}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Improvements */}
      {improvements.length > 0 && (
        <div className="bg-card rounded-2xl p-4 border border-border">
          <p className="text-sm font-semibold text-text mb-3">
            Pistes d&apos;amélioration
          </p>
          <div className="space-y-3">
            {improvements.map((tip, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-accent/15 text-accent flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {tip}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────

export default function BienDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [property, setProperty] = useState<Property | null>(null);
  const [loan, setLoan] = useState<Loan | null>(null);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [revenue, setRevenue] = useState<Revenue | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    async function load() {
      const [
        { data: prop },
        { data: loanData },
        { data: chargesData },
        { data: revData },
      ] = await Promise.all([
        supabase.from("properties").select("*").eq("id", id).single(),
        supabase
          .from("loans")
          .select("id, amount, rate, duration_years, monthly_payment, remaining_capital")
          .eq("property_id", id)
          .maybeSingle(),
        supabase
          .from("charges")
          .select("type, amount, frequency")
          .eq("property_id", id),
        supabase
          .from("revenues")
          .select("monthly_rent, vacancy_rate")
          .eq("property_id", id)
          .maybeSingle(),
      ]);

      if (!prop) {
        router.push("/biens");
        return;
      }

      setProperty(prop);
      setLoan(loanData ?? null);
      setCharges(chargesData ?? []);
      setRevenue(revData ?? null);
      setLoading(false);
    }

    load();
  }, [id, router]);

  if (loading || !property) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg">
        <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  const scores = computeScoreDetails(property, loan, charges, revenue);
  const { lines, total: cashflowTotal } = computeCashflowLines(
    property,
    loan,
    charges,
    revenue
  );
  const cfPositive = cashflowTotal >= 0;
  const { text: scoreTextClass, bg: scoreBgClass } = scoreStyle(scores.global);

  const monthlyRent = revenue?.monthly_rent ?? 0;
  const { taxeFonciere, copro, pno, gli, travaux } = getChargeAmounts(charges);
  const annualChargesTotal =
    taxeFonciere + copro + pno + gli + travaux + (loan?.monthly_payment ?? 0) * 12;
  const rendementNet =
    property.purchase_price > 0
      ? ((monthlyRent * 12 - annualChargesTotal) / property.purchase_price) * 100
      : 0;

  const monthlyInterest = loan
    ? (loan.remaining_capital ?? 0) * ((loan.rate ?? 0) / 100 / 12)
    : 0;
  const monthlyPrincipal = loan
    ? Math.max(0, loan.monthly_payment - monthlyInterest)
    : 0;

  const TABS = ["Vue d'ensemble", "Cashflow", "Score"];

  return (
    <div className="min-h-screen bg-bg pb-24">
      {/* Custom sticky header */}
      <div className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <Link
            href="/biens"
            className="w-9 h-9 rounded-xl bg-bg border border-border flex items-center justify-center text-text-secondary hover:text-text transition-colors shrink-0"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-text truncate">
              {property.name}
            </p>
            {property.regime && (
              <p className="text-[11px] text-text-secondary">{property.regime}</p>
            )}
          </div>
          <div
            className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${scoreTextClass} ${scoreBgClass}`}
          >
            {scores.global}/100
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4 max-w-2xl mx-auto">
        {/* Score summary card */}
        <div className="bg-card rounded-2xl p-4 border border-border flex gap-4 items-center">
          <ScoreRing score={scores.global} size={80} />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-text-secondary leading-relaxed mb-2">
              {scoreSummary(scores.global, cashflowTotal)}
            </p>
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[10px] px-2 py-0.5 bg-bg border border-border rounded-full text-text-secondary">
                {TYPE_LABEL[property.type] ?? property.type}
              </span>
              {property.surface && (
                <span className="text-[10px] px-2 py-0.5 bg-bg border border-border rounded-full text-text-secondary">
                  {property.surface} m²
                </span>
              )}
              {property.address && (
                <span className="text-[10px] px-2 py-0.5 bg-bg border border-border rounded-full text-text-secondary truncate max-w-[160px]">
                  {property.address.split(",").pop()?.trim() ??
                    property.address}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 3 KPI cards */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-card rounded-2xl p-3 border border-border">
            <p className="text-[10px] text-text-secondary uppercase tracking-wide mb-1 leading-tight">
              Cashflow net
            </p>
            <p
              className={`font-mono font-bold text-base leading-tight ${
                cfPositive ? "text-green" : "text-red"
              }`}
            >
              {cfPositive ? "+" : "−"}
              {fmt(cashflowTotal)} €
            </p>
            <p className="text-[10px] text-text-secondary">/mois</p>
          </div>
          <div className="bg-card rounded-2xl p-3 border border-border">
            <p className="text-[10px] text-text-secondary uppercase tracking-wide mb-1 leading-tight">
              Rendement net
            </p>
            <p className="font-mono font-bold text-base leading-tight text-text">
              {rendementNet.toFixed(1)} %
            </p>
            <p className="text-[10px] text-text-secondary">annuel</p>
          </div>
          <div className="bg-card rounded-2xl p-3 border border-border">
            <p className="text-[10px] text-text-secondary uppercase tracking-wide mb-1 leading-tight">
              Capital /mois
            </p>
            <p className="font-mono font-bold text-base leading-tight text-green">
              +{fmt(monthlyPrincipal)} €
            </p>
            <p className="text-[10px] text-text-secondary">remboursé</p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="relative flex bg-bg rounded-xl p-1 border border-border">
          <div
            className="absolute top-1 bottom-1 rounded-lg bg-card border border-border shadow-sm transition-all duration-200 ease-in-out"
            style={{
              left: `calc(4px + ${tab} * (100% - 8px) / 3)`,
              width: `calc((100% - 8px) / 3)`,
            }}
          />
          {TABS.map((t, i) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(i)}
              className={`relative z-10 flex-1 py-2 text-xs font-medium rounded-lg transition-colors duration-200 ${
                tab === i ? "text-text" : "text-text-secondary"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 0 && <TabOverview property={property} loan={loan} />}
        {tab === 1 && <TabCashflow lines={lines} total={cashflowTotal} />}
        {tab === 2 && <TabScore scores={scores} />}
      </div>
    </div>
  );
}
