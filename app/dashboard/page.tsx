"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Home,
  Store,
  Warehouse,
  Building,
  Plus,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  computeNetCashflow,
  computeScoreDetails,
  getChargeAmounts,
  computeMonthlyTax,
  projectRemainingCapital,
} from "@/lib/calculations";
import type { Property, Loan, Charge, Revenue } from "@/lib/calculations";

// ── Extended types (include property_id for Supabase joins) ───

type DashLoan = Loan & {
  property_id: string;
  amount: number;
  rate: number;
  duration_years: number;
  remaining_capital: number;
};

type DashCharge = Charge & { property_id: string };
type DashRevenue = Revenue & { property_id: string };

type Entry = {
  property: Property;
  loan: DashLoan | null;
  charges: DashCharge[];
  revenue: DashRevenue | null;
  cashflow: number;
  score: number;
};

// ── Helpers ───────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(Math.abs(n)));
}

function fmtK(n: number): string {
  if (Math.abs(n) >= 1_000_000)
    return (n / 1_000_000).toFixed(1).replace(".", ",") + " M€";
  if (Math.abs(n) >= 1_000) return Math.round(n / 1_000) + " K€";
  return fmt(n) + " €";
}

function scoreStyle(score: number) {
  if (score >= 75) return { text: "text-green", bg: "bg-green/15" };
  if (score >= 50) return { text: "text-accent", bg: "bg-accent/15" };
  if (score >= 30) return { text: "text-[#FBBF24]", bg: "bg-[#FBBF24]/15" };
  return { text: "text-red", bg: "bg-red/15" };
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  appartement: Building2,
  maison: Home,
  studio: Building,
  immeuble: Warehouse,
  commercial: Store,
};

const MONTHS_FR = [
  "Jan","Fév","Mar","Avr","Mai","Jun",
  "Jul","Aoû","Sep","Oct","Nov","Déc",
];

// ── Skeleton ─────────────────────────────────────────────────

function Sk({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-xl bg-border/40 ${className ?? ""}`} />
  );
}

function LoadingSkeleton() {
  return (
    <div className="px-4 pt-5 pb-8 max-w-2xl mx-auto space-y-4">
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <Sk className="h-6 w-36" />
          <Sk className="h-4 w-24" />
        </div>
        <Sk className="h-7 w-28 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Sk key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Sk className="h-56 rounded-2xl" />
      <Sk className="h-44 rounded-2xl" />
    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  unit,
  sub,
  positive,
}: {
  label: string;
  value: string;
  unit: string;
  sub: string;
  positive?: boolean;
}) {
  return (
    <div className="bg-card rounded-2xl p-4 border border-border flex flex-col gap-1">
      <span className="text-text-secondary text-xs font-medium tracking-wide uppercase">
        {label}
      </span>
      <div className="flex items-baseline gap-1 mt-1">
        <span
          className={`font-mono font-bold text-[1.55rem] leading-tight ${
            positive ? "text-green" : "text-text"
          }`}
        >
          {value}
        </span>
        <span
          className={`font-mono text-sm ${
            positive ? "text-green" : "text-text-secondary"
          }`}
        >
          {unit}
        </span>
      </div>
      <span className="text-text-secondary text-[11px] leading-tight">{sub}</span>
    </div>
  );
}

// ── Patrimoine Chart ──────────────────────────────────────────

function PatrimoineChart({ patrimoine }: { patrimoine: number }) {
  const now = new Date();
  const chartData = Array.from({ length: 12 }, (_, i) => ({
    month: MONTHS_FR[new Date(now.getFullYear(), now.getMonth() - (11 - i), 1).getMonth()],
    value: patrimoine / Math.pow(1.015, 11 - i),
  }));

  const growthPct =
    chartData[0].value > 0
      ? ((chartData[11].value - chartData[0].value) / chartData[0].value) * 100
      : 0;

  const W = 560;
  const H = 140;
  const PAD = { top: 10, right: 8, bottom: 30, left: 46 };

  const values = chartData.map((d) => d.value);
  const minVal = Math.min(...values) * 0.96;
  const maxVal = Math.max(...values) * 1.01;
  const range = maxVal - minVal || 1;

  const plotH = H - PAD.top - PAD.bottom;
  const plotW = W - PAD.left - PAD.right;
  const gap = plotW / values.length;
  const barW = gap * 0.52;

  const barY = (v: number) => PAD.top + plotH - ((v - minVal) / range) * plotH;
  const barH = (v: number) => Math.max(2, ((v - minVal) / range) * plotH);

  const gridStops = [0, 0.33, 0.67, 1];

  return (
    <div className="bg-card rounded-2xl p-4 border border-border">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-text">
            Évolution patrimoine net
          </p>
          <p className="text-[11px] text-text-secondary">12 derniers mois</p>
        </div>
        <div className="flex items-center gap-1 bg-green/10 text-green text-[11px] font-semibold px-2.5 py-1 rounded-full border border-green/20">
          <TrendingUp size={10} strokeWidth={2.5} />
          +{growthPct.toFixed(1)} %
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: 180 }}
        aria-label="Évolution patrimoine net sur 12 mois"
      >
        <defs>
          <linearGradient id="lastBarGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6C63FF" />
            <stop offset="100%" stopColor="#00D9A6" />
          </linearGradient>
        </defs>

        {gridStops.map((t, i) => {
          const y = PAD.top + plotH * (1 - t);
          const label = Math.round((minVal + range * t) / 1000);
          return (
            <g key={i}>
              <line
                x1={PAD.left}
                y1={y}
                x2={W - PAD.right}
                y2={y}
                stroke="var(--border)"
                strokeWidth={0.7}
                strokeDasharray="4 3"
              />
              <text
                x={PAD.left - 6}
                y={y + 4}
                textAnchor="end"
                fontSize={9}
                fill="var(--text-secondary)"
              >
                {label}K
              </text>
            </g>
          );
        })}

        {chartData.map((d, i) => {
          const isLast = i === chartData.length - 1;
          const x = PAD.left + gap * i + (gap - barW) / 2;
          const bY = barY(d.value);
          const bH = barH(d.value);

          return (
            <g key={i}>
              <rect
                x={x}
                y={bY}
                width={barW}
                height={bH}
                rx={3}
                fill={isLast ? "url(#lastBarGrad)" : "var(--accent)"}
                opacity={isLast ? 1 : 0.28}
              />
              {isLast && (
                <>
                  <rect
                    x={x + barW / 2 - 24}
                    y={bY - 20}
                    width={48}
                    height={16}
                    rx={4}
                    fill="var(--accent)"
                    opacity={0.15}
                  />
                  <text
                    x={x + barW / 2}
                    y={bY - 8}
                    textAnchor="middle"
                    fontSize={9}
                    fill="var(--accent)"
                    fontWeight={700}
                  >
                    {fmtK(patrimoine)}
                  </text>
                </>
              )}
              <text
                x={x + barW / 2}
                y={H - PAD.bottom + 14}
                textAnchor="middle"
                fontSize={9}
                fill={isLast ? "var(--text)" : "var(--text-secondary)"}
                fontWeight={isLast ? 600 : 400}
              >
                {d.month}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div
        className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6"
        style={{
          background: "linear-gradient(135deg, rgba(108,99,255,0.15) 0%, rgba(0,217,166,0.15) 100%)",
          border: "1px solid rgba(108,99,255,0.25)",
        }}
      >
        <Building2 size={36} className="text-accent" strokeWidth={1.4} />
      </div>
      <h2 className="text-lg font-bold text-text mb-2">
        Ajoutez votre premier bien
      </h2>
      <p className="text-sm text-text-secondary leading-relaxed mb-8 max-w-xs">
        Calculez votre cashflow réel, votre rendement net et pilotez votre
        patrimoine immobilier en temps réel.
      </p>
      <Link
        href="/biens/nouveau"
        className="px-6 py-3 rounded-xl text-sm font-semibold text-white flex items-center gap-2 active:scale-[0.98] transition-transform"
        style={{
          background: "linear-gradient(135deg, #6C63FF 0%, #00D9A6 100%)",
        }}
      >
        <Plus size={16} />
        Ajouter mon premier bien
      </Link>
    </div>
  );
}

// ── Property Row ─────────────────────────────────────────────

function PropertyRow({ entry }: { entry: Entry }) {
  const { property, revenue, cashflow, score } = entry;
  const Icon = TYPE_ICONS[property.type] ?? Building2;
  const { text, bg } = scoreStyle(score);
  const cfPositive = cashflow >= 0;
  const monthlyRent = revenue?.monthly_rent ?? 0;

  return (
    <Link href={`/biens/${property.id}`}>
      <div className="flex items-center gap-3 py-3.5 border-b border-border last:border-0 hover:bg-bg/50 -mx-1 px-1 rounded-lg transition-colors active:scale-[0.99]">
        <div className="w-10 h-10 rounded-xl bg-bg flex items-center justify-center text-accent shrink-0 border border-border">
          <Icon size={18} strokeWidth={1.8} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text truncate">
            {property.name}
          </p>
          <p className="text-[11px] text-text-secondary">
            {property.regime ?? "LMNP"} ·{" "}
            {monthlyRent > 0 ? `${fmt(monthlyRent)} €/mo` : "Pas de loyer"}
          </p>
        </div>

        <div
          className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${text} ${bg}`}
        >
          {score}/100
        </div>

        <div
          className={`font-mono text-sm font-bold w-[4.5rem] text-right shrink-0 ${
            cfPositive ? "text-green" : "text-red"
          }`}
        >
          {cfPositive ? "+" : "−"}
          {fmt(cashflow)} €
        </div>

        <ChevronRight size={14} className="text-text-secondary shrink-0" />
      </div>
    </Link>
  );
}

// ── Page ─────────────────────────────────────────────────────

const MONTH_GROWTH_MOCK = 2.4;

export default function DashboardPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: properties } = await supabase
        .from("properties")
        .select("*")
        .order("created_at", { ascending: false });

      if (!properties?.length) {
        setLoading(false);
        return;
      }

      const ids = properties.map((p) => p.id);

      const [{ data: loans }, { data: charges }, { data: revenues }] =
        await Promise.all([
          supabase
            .from("loans")
            .select(
              "property_id, amount, rate, duration_years, monthly_payment, remaining_capital"
            )
            .in("property_id", ids),
          supabase
            .from("charges")
            .select("property_id, type, amount, frequency")
            .in("property_id", ids),
          supabase
            .from("revenues")
            .select("property_id, monthly_rent, vacancy_rate")
            .in("property_id", ids),
        ]);

      const result: Entry[] = properties.map((p) => {
        const loan =
          (loans?.find((l) => l.property_id === p.id) as DashLoan) ?? null;
        const propCharges =
          (charges?.filter((c) => c.property_id === p.id) as DashCharge[]) ??
          [];
        const revenue =
          (revenues?.find((r) => r.property_id === p.id) as DashRevenue) ??
          null;

        return {
          property: p as Property,
          loan,
          charges: propCharges,
          revenue,
          cashflow: computeNetCashflow(p as Property, loan, propCharges, revenue),
          score: computeScoreDetails(p as Property, loan, propCharges, revenue).global,
        };
      });

      setEntries(result);
      setLoading(false);
    }

    load();
  }, []);

  if (loading) return <LoadingSkeleton />;

  // ── KPI calculations ────────────────────────────────────────

  const patrimoineNet = entries.reduce(
    (s, e) => s + e.property.current_value - (e.loan?.remaining_capital ?? 0),
    0
  );

  const cashflowMensuel = entries.reduce((s, e) => s + e.cashflow, 0);

  // Rendement net: (loyers − charges opex − impôts) / prix achat
  const totalNetOperating = entries.reduce((s, e) => {
    const { taxeFonciere, copro, pno, gli, travaux } = getChargeAmounts(
      e.charges
    );
    const monthlyRent = e.revenue?.monthly_rent ?? 0;
    const annualRent = monthlyRent * 12;
    const opexAnnual = taxeFonciere + copro + pno + gli + travaux;
    const annualTax =
      computeMonthlyTax(
        e.property.regime,
        annualRent,
        opexAnnual,
        e.loan,
        e.property.purchase_price
      ) * 12;
    return s + annualRent - opexAnnual - annualTax;
  }, 0);

  const totalPurchasePrice = entries.reduce(
    (s, e) => s + e.property.purchase_price,
    0
  );
  const rendementNet =
    totalPurchasePrice > 0
      ? (totalNetOperating / totalPurchasePrice) * 100
      : 0;

  // Projection 10 ans: somme des (valeur × 1.02^10) − capitaux restants projetés
  const projection10ans = entries.reduce((s, e) => {
    const val10 = e.property.current_value * Math.pow(1.02, 10);
    const cap10 = e.loan ? projectRemainingCapital(e.loan, 10) : 0;
    return s + val10 - cap10;
  }, 0);

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="px-4 pt-5 pb-8 max-w-2xl mx-auto space-y-4">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-text leading-tight">
            Vue d&apos;ensemble
          </h1>
          <p className="text-text-secondary text-sm mt-0.5">
            {entries.length === 0
              ? "Aucun bien suivi"
              : `${entries.length} bien${entries.length > 1 ? "s" : ""} suivi${entries.length > 1 ? "s" : ""}`}
          </p>
        </div>
        {entries.length > 0 && (
          <div className="flex items-center gap-1.5 bg-green/10 text-green text-xs font-semibold px-3 py-1.5 rounded-full border border-green/20">
            <TrendingUp size={12} strokeWidth={2.5} />
            +{MONTH_GROWTH_MOCK} % ce mois
          </div>
        )}
      </div>

      {entries.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* KPI 2×2 grid */}
          <div className="grid grid-cols-2 gap-3">
            <KpiCard
              label="Patrimoine net"
              value={fmtK(patrimoineNet).replace(/[€KM]/g, "").trim()}
              unit={
                Math.abs(patrimoineNet) >= 1_000_000
                  ? "M€"
                  : Math.abs(patrimoineNet) >= 1_000
                  ? "K€"
                  : "€"
              }
              sub="valeur − crédits"
            />
            <KpiCard
              label="Cashflow mensuel"
              value={`${cashflowMensuel >= 0 ? "+" : "−"}${fmt(cashflowMensuel)}`}
              unit="€/mo"
              sub="après charges & impôts"
              positive={cashflowMensuel >= 0}
            />
            <KpiCard
              label="Rendement net"
              value={rendementNet.toFixed(1).replace(".", ",")}
              unit="%"
              sub="charges & fiscalité incluses"
            />
            <KpiCard
              label="Projection 10 ans"
              value={fmtK(projection10ans).replace(/[€KM]/g, "").trim()}
              unit={
                Math.abs(projection10ans) >= 1_000_000
                  ? "M€"
                  : Math.abs(projection10ans) >= 1_000
                  ? "K€"
                  : "€"
              }
              sub="hyp. revalorisation 2 %"
            />
          </div>

          {/* Patrimoine chart */}
          {patrimoineNet > 0 && (
            <PatrimoineChart patrimoine={patrimoineNet} />
          )}

          {/* Property list */}
          <div className="bg-card rounded-2xl p-4 border border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-text">Mes biens</p>
              <Link
                href="/biens"
                className="text-[11px] text-accent font-medium"
              >
                Voir tout
              </Link>
            </div>
            <div>
              {entries.map((e) => (
                <PropertyRow key={e.property.id} entry={e} />
              ))}
            </div>
            <Link
              href="/biens/nouveau"
              className="mt-3 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-border text-xs font-medium text-text-secondary hover:text-text hover:border-accent/40 transition-colors"
            >
              <Plus size={13} />
              Ajouter un bien
            </Link>
          </div>

          <p className="text-[11px] text-text-secondary text-center px-2 leading-relaxed">
            Calculs indicatifs (TMI 30 % par défaut). Consultez un
            expert-comptable.
          </p>
        </>
      )}
    </div>
  );
}
