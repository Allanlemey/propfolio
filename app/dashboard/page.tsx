"use client";

import { Building2, Home, Car, Store, ChevronRight, TrendingUp } from "lucide-react";

// ── Mock data ─────────────────────────────────────────────────

const BIENS_COUNT = 4;
const MONTH_GROWTH = 2.6;

const KPI_CARDS = [
  {
    label: "Patrimoine net",
    value: "487 500",
    unit: "€",
    sub: "+12 340 € depuis jan.",
    positive: false,
  },
  {
    label: "Cashflow mensuel",
    value: "+2 340",
    unit: "€/mo",
    sub: "après charges & rembt.",
    positive: true,
  },
  {
    label: "Rendement net",
    value: "6,8",
    unit: "%",
    sub: "vs 5,2 % marché",
    positive: false,
  },
  {
    label: "Projection 10 ans",
    value: "712",
    unit: "K€",
    sub: "avec +3 % revalorisation",
    positive: false,
  },
];

const CHART_DATA = [
  { month: "Avr", value: 412000 },
  { month: "Mai", value: 418000 },
  { month: "Jun", value: 423000 },
  { month: "Jul", value: 431000 },
  { month: "Aoû", value: 435000 },
  { month: "Sep", value: 440000 },
  { month: "Oct", value: 447000 },
  { month: "Nov", value: 452000 },
  { month: "Déc", value: 460000 },
  { month: "Jan", value: 469000 },
  { month: "Fév", value: 478000 },
  { month: "Mar", value: 487500 },
];

const PROPERTIES = [
  { id: 1, name: "Studio Gambetta", type: "appartement", regime: "LMNP", rent: 850, score: 87, cashflow: 320 },
  { id: 2, name: "T2 Belleville", type: "appartement", regime: "LMNP", rent: 1200, score: 72, cashflow: 180 },
  { id: 3, name: "Parking Nation", type: "parking", regime: "Nu", rent: 150, score: 61, cashflow: 90 },
  { id: 4, name: "Local Commerce", type: "commercial", regime: "SCI", rent: 2100, score: 54, cashflow: -120 },
];

// ── Helpers ───────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.abs(n));
}

function scoreStyle(score: number): { text: string; bg: string } {
  if (score >= 80) return { text: "text-green", bg: "bg-green/15" };
  if (score >= 60) return { text: "text-[#F59E0B]", bg: "bg-[#F59E0B]/15" };
  return { text: "text-red", bg: "bg-red/15" };
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  appartement: Building2,
  maison: Home,
  parking: Car,
  commercial: Store,
};

// ── KPI Card ─────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  unit,
  sub,
  positive,
}: (typeof KPI_CARDS)[number]) {
  return (
    <div className="bg-card rounded-2xl p-4 border border-border flex flex-col gap-1">
      <span className="text-text-secondary text-xs font-medium tracking-wide uppercase">
        {label}
      </span>
      <div className="flex items-baseline gap-1 mt-1">
        <span
          className={`font-mono font-bold text-[1.6rem] leading-tight ${
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

// ── Bar chart ─────────────────────────────────────────────────

function PatrimoineChart() {
  const W = 560;
  const H = 140;
  const PAD = { top: 10, right: 8, bottom: 30, left: 46 };

  const values = CHART_DATA.map((d) => d.value);
  const minVal = Math.min(...values) * 0.96;
  const maxVal = Math.max(...values) * 1.01;
  const range = maxVal - minVal;

  const plotH = H - PAD.top - PAD.bottom;
  const plotW = W - PAD.left - PAD.right;
  const gap = plotW / values.length;
  const barW = gap * 0.52;

  const barY = (v: number) => PAD.top + plotH - ((v - minVal) / range) * plotH;
  const barH = (v: number) => ((v - minVal) / range) * plotH;

  const gridStops = [0, 0.33, 0.67, 1];

  return (
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

      {/* Grid lines + Y axis labels */}
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

      {/* Bars */}
      {CHART_DATA.map((d, i) => {
        const isLast = i === CHART_DATA.length - 1;
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
            {/* Value tooltip on last bar */}
            {isLast && (
              <>
                <rect
                  x={x + barW / 2 - 22}
                  y={bY - 20}
                  width={44}
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
                  488 K€
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
  );
}

// ── Property row ─────────────────────────────────────────────

function PropertyRow({
  name,
  type,
  regime,
  rent,
  score,
  cashflow,
}: (typeof PROPERTIES)[number]) {
  const Icon = TYPE_ICONS[type] ?? Building2;
  const { text, bg } = scoreStyle(score);
  const cfPositive = cashflow >= 0;

  return (
    <div className="flex items-center gap-3 py-3.5 border-b border-border last:border-0">
      {/* Type icon */}
      <div className="w-10 h-10 rounded-xl bg-bg flex items-center justify-center text-accent shrink-0">
        <Icon size={18} strokeWidth={1.8} />
      </div>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text truncate">{name}</p>
        <p className="text-[11px] text-text-secondary">
          {regime} · {fmt(rent)} €/mo
        </p>
      </div>

      {/* Score badge */}
      <div
        className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${text} ${bg}`}
      >
        {score}/100
      </div>

      {/* Cashflow */}
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
  );
}

// ── Page ─────────────────────────────────────────────────────

export default function DashboardPage() {
  return (
    <div className="px-4 pt-5 pb-8 max-w-2xl mx-auto space-y-4">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-text leading-tight">
            Vue d&apos;ensemble
          </h1>
          <p className="text-text-secondary text-sm mt-0.5">
            {BIENS_COUNT} biens suivis
          </p>
        </div>
        <div className="flex items-center gap-1.5 bg-green/10 text-green text-xs font-semibold px-3 py-1.5 rounded-full border border-green/20">
          <TrendingUp size={12} strokeWidth={2.5} />
          +{MONTH_GROWTH} % ce mois
        </div>
      </div>

      {/* KPI 2×2 grid */}
      <div className="grid grid-cols-2 gap-3">
        {KPI_CARDS.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      {/* Patrimoine chart */}
      <div className="bg-card rounded-2xl p-4 border border-border">
        <p className="text-sm font-semibold text-text mb-0.5">
          Évolution patrimoine net
        </p>
        <p className="text-[11px] text-text-secondary mb-3">12 derniers mois</p>
        <PatrimoineChart />
      </div>

      {/* Property list */}
      <div className="bg-card rounded-2xl p-4 border border-border">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-semibold text-text">Mes biens</p>
          <span className="text-[11px] text-accent font-medium">Voir tout</span>
        </div>
        <div>
          {PROPERTIES.map((p) => (
            <PropertyRow key={p.id} {...p} />
          ))}
        </div>
      </div>
    </div>
  );
}
