"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useUserTmi } from "@/hooks/use-user-tmi";
import Link from "next/link";
import {
  Building2, Home, Store, Warehouse, Building, Plus,
  ChevronRight, TrendingUp, X, Percent,
  CalendarRange, Wallet, Landmark, ArrowUpRight,
  Newspaper, GraduationCap, ArrowDown, Activity, Info
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  computeNetCashflow, computeScoreDetails,
  getChargeAmounts, computeMonthlyTax, projectRemainingCapital,
} from "@/lib/calculations";
import type { Property, Loan, Charge, Revenue } from "@/lib/calculations";
import { NEWS_ARTICLES, type Article } from "@/lib/news";
import { MARKET_RATES } from "@/lib/market-rates";

// ── Types ─────────────────────────────────────────────────────

type DashLoan = Loan & {
  property_id: string; amount: number; rate: number;
  duration_years: number; remaining_capital: number;
};
type DashCharge = Charge & { property_id: string };
type DashRevenue = Revenue & { property_id: string };
type Entry = {
  property: Property; loan: DashLoan | null;
  charges: DashCharge[]; revenue: DashRevenue | null;
  cashflow: number; score: number;
};

type KpiKey = "patrimoine" | "cashflow" | "rendement" | "projection";

// ── Helpers ───────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(Math.abs(n)));
}
function fmtK(n: number) {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(".", ",") + " M€";
  if (Math.abs(n) >= 1_000) return Math.round(n / 1_000) + " K€";
  return fmt(n) + " €";
}
function scoreStyle(s: number) {
  if (s >= 75) return { text: "text-green", bg: "bg-green/15" };
  if (s >= 50) return { text: "text-accent", bg: "bg-accent/15" };
  if (s >= 30) return { text: "text-[#FBBF24]", bg: "bg-[#FBBF24]/15" };
  return { text: "text-red", bg: "bg-red/15" };
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  appartement: Building2, maison: Home, studio: Building,
  immeuble: Warehouse, commercial: Store,
};
const MONTHS_FR = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

// ── Skeleton ─────────────────────────────────────────────────

function Sk({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-border/40 ${className ?? ""}`} />;
}
function LoadingSkeleton() {
  return (
    <div className="px-4 pt-5 pb-8 max-w-2xl mx-auto space-y-4">
      <div className="flex items-start justify-between">
        <div className="space-y-1.5"><Sk className="h-6 w-36" /><Sk className="h-4 w-24" /></div>
        <Sk className="h-7 w-28 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-3">{[0,1,2,3].map(i => <Sk key={i} className="h-24 rounded-2xl" />)}</div>
      <Sk className="h-56 rounded-2xl" />
      <Sk className="h-44 rounded-2xl" />
    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────────────

type KpiColor = "accent" | "green" | "yellow" | "red";

const KPI_COLORS: Record<KpiColor, { main: string; glow: string; bg: string; border: string; grad1: string; grad2: string; light: string }> = {
  accent:  { main: "var(--accent)", glow: "rgba(99,102,241,0.25)", bg: "var(--accent-light)", border: "rgba(99,102,241,0.2)", grad1: "#6366F1", grad2: "#818CF8", light: "var(--accent-light)" },
  green:   { main: "var(--green)",  glow: "rgba(16,185,129,0.25)", bg: "var(--green-light)",  border: "rgba(16,185,129,0.2)",  grad1: "#10B981", grad2: "#34D399", light: "var(--green-light)" },
  yellow:  { main: "var(--yellow)", glow: "rgba(245,158,11,0.25)",  bg: "var(--yellow-light)", border: "rgba(245,158,11,0.2)",  grad1: "#F59E0B", grad2: "#FBBF24", light: "var(--yellow-light)" },
  red:     { main: "var(--red)",    glow: "rgba(239,68,68,0.25)",   bg: "var(--red-light)",    border: "rgba(239,68,68,0.2)",    grad1: "#EF4444", grad2: "#F87171", light: "var(--red-light)" },
};

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const w = 44;
  const h = 20;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: h - ((v - min) / range) * (h - 6) - 3,
  }));

  let path = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const cp = (pts[i + 1].x - pts[i].x) * 0.4;
    path += ` C${pts[i].x + cp},${pts[i].y} ${pts[i + 1].x - cp},${pts[i + 1].y} ${pts[i + 1].x},${pts[i + 1].y}`;
  }

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0 overflow-visible self-end" style={{ filter: `drop-shadow(0 2px 4px ${color}33)` }}>
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r={2.5} fill={color} stroke="var(--card)" strokeWidth={1} />
    </svg>
  );
}

function KpiCard({
  label, value, unit, sub, positive, onClick, active,
  icon: Icon, color = "accent", sparkData, negative,
}: {
  label: string; value: string; unit: string; sub: string;
  positive?: boolean; negative?: boolean; onClick: () => void; active?: boolean;
  icon: React.ElementType; color?: KpiColor; sparkData?: number[];
}) {
  const c = KPI_COLORS[negative ? "red" : color];
  const valueColor = negative ? "text-red" : positive ? "text-green" : "text-text";

  return (
    <button
      onClick={onClick}
      className={`relative overflow-hidden bg-card rounded-[22px] p-3.5 text-left flex flex-col gap-1.5 w-full min-w-0 transition-all duration-300 active:scale-[0.96] border shadow-sm ${
        active
          ? "border-transparent ring-2 ring-offset-2 ring-offset-bg"
          : "border-border/60 hover:border-accent/40 hover:shadow-md"
      }`}
      style={{
        boxShadow: active ? `0 10px 25px -5px ${c.glow}, 0 8px 10px -6px ${c.glow}` : undefined,
        borderColor: active ? c.main : undefined,
        transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      }}
    >
      {/* Decorative gradient corner */}
      <div
        className="absolute -right-4 -top-4 w-12 h-12 rounded-full opacity-10 blur-xl"
        style={{ background: c.grad1 }}
      />

      {active && (
        <div className="absolute inset-0 bg-gradient-to-br from-transparent to-white/5 pointer-events-none" />
      )}

      {/* Header: icon + label */}
      <div className="flex items-center justify-between gap-1 z-10 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 shadow-sm"
            style={{ background: c.light, border: `1px solid ${c.border}` }}
          >
            <Icon size={12} style={{ color: c.main }} strokeWidth={2.5} />
          </div>
          <span className="text-text-secondary text-[9px] font-bold tracking-[0.06em] uppercase truncate">{label}</span>
        </div>
        <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-all ${active ? "bg-accent text-white" : "bg-bg text-border"}`}>
            <ChevronRight size={8} strokeWidth={3} />
        </div>
      </div>

      {/* Value row + sparkline */}
      <div className="flex items-end justify-between gap-1.5 z-10 min-w-0">
        <div className="flex items-baseline gap-0.5 min-w-0 overflow-hidden">
          <span className={`font-mono font-bold text-[1.35rem] leading-none tracking-tight truncate ${valueColor}`}>
            {value}
          </span>
          <span className={`font-mono text-[10px] font-bold opacity-80 shrink-0 ${
            negative ? "text-red" : positive ? "text-green" : "text-text-secondary"
          }`}>
            {unit}
          </span>
        </div>
        {sparkData && <MiniSparkline data={sparkData} color={c.main} />}
      </div>

      {/* Subtitle */}
      <span className="text-text-muted text-[9px] font-medium leading-tight z-10 flex items-center gap-1 truncate">
          <div className="w-1 h-1 rounded-full shrink-0" style={{ background: c.main }} />
          <span className="truncate">{sub}</span>
      </span>
    </button>
  );
}

// ── Chart ─────────────────────────────────────────────────────

type RangeKey = "6M" | "1A" | "2A" | "5A";
const RANGE_MONTHS: Record<RangeKey, number> = { "6M": 6, "1A": 12, "2A": 24, "5A": 60 };
const RANGE_GROWTH: Record<RangeKey, number> = { "6M": 1.012, "1A": 1.015, "2A": 1.014, "5A": 1.013 };

function PatrimoineChart({ patrimoine }: { patrimoine: number }) {
  const [range, setRange] = useState<RangeKey>("1A");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const months = RANGE_MONTHS[range];
  const growth = RANGE_GROWTH[range];
  const now = new Date();

  const chartData = Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    return {
      label: months <= 12
        ? MONTHS_FR[d.getMonth()]
        : `${MONTHS_FR[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
      shortLabel: MONTHS_FR[d.getMonth()],
      fullLabel: `${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`,
      year: d.getFullYear(),
      value: patrimoine / Math.pow(growth, months - 1 - i),
    };
  });

  const first = chartData[0].value;
  const last = chartData[chartData.length - 1].value;
  const growthPct = first > 0 ? ((last - first) / first) * 100 : 0;

  const W = 580;
  const H = 220;
  const PAD = { top: 30, right: 15, bottom: 40, left: 55 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const values = chartData.map(d => d.value);
  const minVal = Math.min(...values) * 0.98;
  const maxVal = Math.max(...values) * 1.02;
  const valRange = maxVal - minVal || 1;

  const xOf = (i: number) => PAD.left + (i / (chartData.length - 1)) * plotW;
  const yOf = (v: number) => PAD.top + plotH - ((v - minVal) / valRange) * plotH;

  const points = chartData.map((d, i) => ({ x: xOf(i), y: yOf(d.value) }));

  function bezierPath(pts: { x: number; y: number }[]): string {
    if (pts.length < 2) return "";
    let path = `M${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
        const cp = (pts[i + 1].x - pts[i].x) * 0.45;
        path += ` C${pts[i].x + cp},${pts[i].y} ${pts[i + 1].x - cp},${pts[i + 1].y} ${pts[i + 1].x},${pts[i + 1].y}`;
    }
    return path;
  }

  const linePath = bezierPath(points);
  const areaPath = `${linePath} L${points[points.length - 1].x},${PAD.top + plotH} L${points[0].x},${PAD.top + plotH} Z`;

  const labelStep = months <= 6 ? 1 : months <= 12 ? 2 : months <= 24 ? 4 : 12;
  const xLabels = chartData
    .map((d, i) => ({ ...d, i }))
    .filter((_, i) => i % labelStep === 0 || i === chartData.length - 1);

  const onMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    let nearest = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const dist = Math.abs(points[i].x - mx);
      if (dist < nearestDist) { nearestDist = dist; nearest = i; }
    }
    setHoverIdx(nearest);
  }, [points]);

  const hoverPoint = hoverIdx !== null ? chartData[hoverIdx] : null;

  return (
    <div className="bg-card rounded-[24px] p-6 border border-border shadow-sm premium-shadow">
      <div className="flex items-start justify-between mb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-accent" />
            <p className="text-sm font-bold text-text">Évolution patrimoine net</p>
          </div>
          <p className="text-[11px] text-text-muted font-medium">
            {hoverPoint
              ? `${hoverPoint.fullLabel} — ${fmtK(hoverPoint.value)}`
              : "Analyse dynamique de votre croissance"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5 bg-green-light text-green text-[11px] font-bold px-3 py-1 rounded-full border border-green/20">
                <TrendingUp size={11} strokeWidth={3} />
                +{growthPct.toFixed(1)}%
            </div>
            <span className="text-[9px] text-text-muted uppercase font-bold tracking-widest leading-none mt-1">Total {range}</span>
        </div>
      </div>

      {/* Range selector */}
      <div className="flex items-center gap-1.5 p-1 bg-bg rounded-xl border border-border/50 max-w-fit mb-6">
        {(["6M", "1A", "2A", "5A"] as RangeKey[]).map(r => (
          <button
            key={r}
            onClick={() => { setRange(r); setHoverIdx(null); }}
            className={`px-4 py-1.5 rounded-lg text-[10px] font-bold tracking-wider transition-all duration-300 ${
              range === r
                ? "bg-card text-accent shadow-sm border border-border active:scale-95"
                : "text-text-muted hover:text-text active:scale-95"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="relative">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto overflow-visible cursor-crosshair"
            onMouseMove={onMouseMove}
            onMouseLeave={() => setHoverIdx(null)}
          >
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.2} />
                <stop offset="60%" stopColor="var(--accent)" stopOpacity={0.05} />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--accent)" />
                <stop offset="100%" stopColor="var(--green)" />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Grid */}
            {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
              const y = PAD.top + plotH * (1 - t);
              return (
                <g key={i}>
                  <line
                    x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                    stroke="var(--border)" strokeWidth={1} opacity={0.3} strokeDasharray="4 4"
                  />
                  <text x={PAD.left - 12} y={y + 3.5} textAnchor="end" fontSize={9}
                    fill="var(--text-muted)" fontWeight={600} fontFamily="system-ui">
                    {fmtK(minVal + valRange * t)}
                  </text>
                </g>
              );
            })}

            {/* Area */}
            <path d={areaPath} fill="url(#areaGrad)" className="transition-all duration-700" />

            {/* Main Line */}
            <path
              d={linePath}
              fill="none"
              stroke="url(#lineGrad)"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#glow)"
              className="transition-all duration-700"
            />

            {/* X-Axis labels */}
            {xLabels.map(d => (
              <text
                key={d.i}
                x={xOf(d.i)}
                y={H - PAD.bottom + 24}
                textAnchor="middle"
                fontSize={9}
                fill="var(--text-muted)"
                fontWeight={700}
                className="tracking-tighter"
              >
                {d.shortLabel}
              </text>
            ))}

            {/* Hover State */}
            {hoverIdx !== null && (() => {
              const px = points[hoverIdx].x;
              const py = points[hoverIdx].y;
              return (
                <g>
                  <line x1={px} y1={PAD.top} x2={px} y2={PAD.top + plotH}
                    stroke="var(--accent)" strokeWidth={1.5} strokeDasharray="4 4" opacity={0.6} />
                  <circle cx={px} cy={py} r={6} fill="var(--card)" stroke="var(--accent)" strokeWidth={2} />
                  <circle cx={px} cy={py} r={2.5} fill="var(--accent)" />
                  
                  {/* Premium Tooltip */}
                  <g transform={`translate(${Math.min(Math.max(px - 60, PAD.left), W - PAD.right - 120)}, ${Math.max(py - 55, 10)})`}>
                      <rect width={120} height={40} rx={12} fill="var(--card)" 
                        className="shadow-xl" filter="url(#glow)" stroke="var(--border)" strokeWidth={1} style={{ opacity: 0.95 }} />
                      <text x={60} y={15} textAnchor="middle" fontSize={9} fontWeight={700} fill="var(--text-muted)" className="uppercase">{chartData[hoverIdx].fullLabel}</text>
                      <text x={60} y={32} textAnchor="middle" fontSize={14} fontWeight={800} fill="var(--text)">{fmtK(chartData[hoverIdx].value)}</text>
                  </g>
                </g>
              );
            })()}
          </svg>
      </div>
    </div>
  );
}

// ── KPI Detail Sheet ──────────────────────────────────────────

function KpiSheet({
  kpi, entries, patrimoine, cashflow, rendement, projection, tmi, onClose,
}: {
  kpi: KpiKey; entries: Entry[];
  patrimoine: number; cashflow: number; rendement: number; projection: number;
  tmi: number;
  onClose: () => void;
}) {
  const TITLES: Record<KpiKey, { label: string; icon: React.ElementType; color: string }> = {
    patrimoine: { label: "Patrimoine net", icon: Building2, color: "text-accent" },
    cashflow:   { label: "Cashflow mensuel", icon: Wallet, color: cashflow >= 0 ? "text-green" : "text-red" },
    rendement:  { label: "Rendement net", icon: Percent, color: "text-[#FBBF24]" },
    projection: { label: "Projection 10 ans", icon: CalendarRange, color: "text-accent" },
  };
  const { label, icon: Icon, color } = TITLES[kpi];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      onClick={onClose}
      style={{ background: "rgba(11,11,26,0.7)", backdropFilter: "blur(6px)" }}
    >
      <div
        className="bg-card border-t border-border rounded-t-3xl max-h-[82vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
        style={{ animation: "slideUp 0.28s cubic-bezier(0.4,0,0.2,1)" }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl bg-bg flex items-center justify-center border border-border`}>
              <Icon size={15} className={color} />
            </div>
            <div>
              <p className="text-sm font-bold text-text">{label}</p>
              <p className={`font-mono text-sm font-bold ${color}`}>
                {kpi === "patrimoine" && fmtK(patrimoine)}
                {kpi === "cashflow" && `${cashflow >= 0 ? "+" : "−"}${fmt(cashflow)} €/mo`}
                {kpi === "rendement" && `${rendement.toFixed(2).replace(".", ",")} %`}
                {kpi === "projection" && fmtK(projection)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-bg border border-border flex items-center justify-center text-text-secondary hover:text-text transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-3 pb-8">
          {kpi === "patrimoine" && (
            <>
              <p className="text-xs text-text-secondary">Valeur actuelle − capital restant par bien</p>
              {entries.map(e => {
                const val = e.property.current_value;
                const cap = e.loan?.remaining_capital ?? 0;
                const pat = val - cap;
                const Icon2 = TYPE_ICONS[e.property.type] ?? Building2;
                return (
                  <Link key={e.property.id} href={`/biens/${e.property.id}`}>
                    <div className="bg-bg border border-border rounded-2xl p-3.5 flex gap-3 items-center hover:border-accent/30 transition-colors">
                      <div className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center text-accent shrink-0">
                        <Icon2 size={16} strokeWidth={1.8} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-text truncate">{e.property.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-text-secondary">{fmtK(val)}</span>
                          <span className="text-[10px] text-border">−</span>
                          <span className="text-[10px] text-text-secondary">{fmtK(cap)} crédit</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono text-sm font-bold text-text">{fmtK(pat)}</p>
                        <p className="text-[10px] text-text-secondary">
                          {val > 0 ? `${((pat / val) * 100).toFixed(0)} % equity` : "—"}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
              <div className="flex items-center justify-between px-3 py-2 bg-accent/8 rounded-xl border border-accent/20">
                <span className="text-xs font-semibold text-text-secondary">Total</span>
                <span className="font-mono text-sm font-bold text-accent">{fmtK(patrimoine)}</span>
              </div>
            </>
          )}

          {kpi === "cashflow" && (
            <>
              <p className="text-xs text-text-secondary">Cashflow net mensuel par bien (après charges & impôts)</p>
              {entries.map(e => {
                const cf = e.cashflow;
                const pos = cf >= 0;
                const Icon2 = TYPE_ICONS[e.property.type] ?? Building2;
                const barPct = patrimoine > 0 ? Math.min(Math.abs(cf) / (Math.abs(cashflow) || 1) * 100, 100) : 0;
                return (
                  <Link key={e.property.id} href={`/biens/${e.property.id}`}>
                    <div className="bg-bg border border-border rounded-2xl p-3.5 hover:border-accent/30 transition-colors">
                      <div className="flex gap-3 items-center mb-2">
                        <div className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center text-accent shrink-0">
                          <Icon2 size={16} strokeWidth={1.8} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-text truncate">{e.property.name}</p>
                          <p className="text-[10px] text-text-secondary">{e.property.regime ?? "LMNP"}</p>
                        </div>
                        <div className={`font-mono text-sm font-bold ${pos ? "text-green" : "text-red"}`}>
                          {pos ? "+" : "−"}{fmt(cf)} €
                        </div>
                      </div>
                      <div className="h-1.5 bg-border rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${barPct}%`, background: pos ? "#00D9A6" : "#FF6B6B" }}
                        />
                      </div>
                    </div>
                  </Link>
                );
              })}
              <div className="flex items-center justify-between px-3 py-2 bg-green/8 rounded-xl border border-green/20">
                <span className="text-xs font-semibold text-text-secondary">Total mensuel</span>
                <span className={`font-mono text-sm font-bold ${cashflow >= 0 ? "text-green" : "text-red"}`}>
                  {cashflow >= 0 ? "+" : "−"}{fmt(cashflow)} €
                </span>
              </div>
            </>
          )}

          {kpi === "rendement" && (
            <>
              <p className="text-xs text-text-secondary">Rendement net / prix d&apos;achat</p>
              {entries.map(e => {
                const { taxeFonciere, copro, pno, gli, travaux } = getChargeAmounts(e.charges);
                const annualRent = (e.revenue?.monthly_rent ?? 0) * 12;
                const opex = taxeFonciere + copro + pno + gli + travaux;
                const tax = computeMonthlyTax(e.property.regime, annualRent, opex, e.loan, e.property.purchase_price, tmi) * 12;
                const netOp = annualRent - opex - tax;
                const rend = e.property.purchase_price > 0 ? (netOp / e.property.purchase_price) * 100 : 0;
                const color = rend >= 6 ? "#00D9A6" : rend >= 4 ? "#FBBF24" : "#FF6B6B";
                const Icon2 = TYPE_ICONS[e.property.type] ?? Building2;
                return (
                  <Link key={e.property.id} href={`/biens/${e.property.id}`}>
                    <div className="bg-bg border border-border rounded-2xl p-3.5 flex gap-3 items-center hover:border-accent/30 transition-colors">
                      <div className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center text-accent shrink-0">
                        <Icon2 size={16} strokeWidth={1.8} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-text truncate">{e.property.name}</p>
                        <p className="text-[10px] text-text-secondary">{fmtK(e.property.purchase_price)} achat</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.min(rend / 10 * 100, 100)}%`, background: color }} />
                        </div>
                        <span className="font-mono text-sm font-bold w-10 text-right" style={{ color }}>
                          {rend.toFixed(1).replace(".", ",")} %
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
              <div className="flex items-center justify-between px-3 py-2 rounded-xl border border-[#FBBF24]/20" style={{ background: "rgba(251,191,36,0.05)" }}>
                <span className="text-xs font-semibold text-text-secondary">Rendement moyen</span>
                <span className="font-mono text-sm font-bold text-[#FBBF24]">{rendement.toFixed(2).replace(".", ",")} %</span>
              </div>
            </>
          )}

          {kpi === "projection" && (
            <>
              <p className="text-xs text-text-secondary">Patrimoine projeté par bien (revalorisation 2 %/an)</p>
              {entries.map(e => {
                const now5 = e.property.current_value * Math.pow(1.02, 5) - (e.loan ? projectRemainingCapital(e.loan, 5) : 0);
                const now10 = e.property.current_value * Math.pow(1.02, 10) - (e.loan ? projectRemainingCapital(e.loan, 10) : 0);
                const Icon2 = TYPE_ICONS[e.property.type] ?? Building2;
                return (
                  <Link key={e.property.id} href={`/biens/${e.property.id}`}>
                    <div className="bg-bg border border-border rounded-2xl p-3.5 hover:border-accent/30 transition-colors">
                      <div className="flex gap-3 items-center mb-3">
                        <div className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center text-accent shrink-0">
                          <Icon2 size={16} strokeWidth={1.8} />
                        </div>
                        <p className="text-sm font-semibold text-text truncate flex-1">{e.property.name}</p>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: "Aujourd'hui", val: e.property.current_value - (e.loan?.remaining_capital ?? 0), dim: true },
                          { label: "Dans 5 ans", val: now5, dim: false },
                          { label: "Dans 10 ans", val: now10, dim: false },
                        ].map(col => (
                          <div key={col.label} className="bg-card rounded-xl p-2 text-center">
                            <p className="text-[9px] text-text-secondary mb-1">{col.label}</p>
                            <p className={`font-mono text-xs font-bold ${col.dim ? "text-text" : "text-accent"}`}>
                              {fmtK(col.val)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Link>
                );
              })}
              <div className="flex items-center justify-between px-3 py-2 bg-accent/8 rounded-xl border border-accent/20">
                <span className="text-xs font-semibold text-text-secondary">Projection totale 10 ans</span>
                <div className="flex items-center gap-1 text-accent">
                  <TrendingUp size={12} />
                  <span className="font-mono text-sm font-bold">{fmtK(projection)}</span>
                </div>
              </div>
              <p className="text-[10px] text-text-secondary text-center">
                Hypothèse : revalorisation 2 %/an. Indicatif.
              </p>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes slideUp { from { transform:translateY(100%) } to { transform:translateY(0) } }`}</style>
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6"
        style={{ background: "linear-gradient(135deg, rgba(108,99,255,0.15) 0%, rgba(0,217,166,0.15) 100%)", border: "1px solid rgba(108,99,255,0.25)" }}>
        <Building2 size={36} className="text-accent" strokeWidth={1.4} />
      </div>
      <h2 className="text-lg font-bold text-text mb-2">Ajoutez votre premier bien</h2>
      <p className="text-sm text-text-secondary leading-relaxed mb-8 max-w-xs">
        Calculez votre cashflow réel, votre rendement net et pilotez votre patrimoine en temps réel.
      </p>
      <Link href="/biens/nouveau"
        className="px-6 py-3 rounded-xl text-sm font-semibold text-white flex items-center gap-2 active:scale-[0.98] transition-transform"
        style={{ background: "linear-gradient(135deg, #6C63FF 0%, #00D9A6 100%)" }}>
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

  return (
    <Link href={`/biens/${property.id}`}>
      <div className="flex items-center gap-4 py-4 px-2 border-b border-border last:border-0 hover:bg-bg/60 -mx-2 rounded-2xl transition-all duration-300 group active:scale-[0.98]">
        <div className="relative">
            <div className={`w-12 h-12 rounded-[14px] bg-bg flex items-center justify-center text-accent shrink-0 border border-border group-hover:border-accent/30 transition-colors shadow-sm`}>
                <Icon size={20} strokeWidth={1.5} />
            </div>
            {cfPositive && (
                <div className="absolute -right-1 -bottom-1 w-4 h-4 bg-green text-white rounded-full flex items-center justify-center border-2 border-card shadow-sm">
                    <TrendingUp size={8} strokeWidth={3} />
                </div>
            )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-bold text-text truncate group-hover:text-accent transition-colors">{property.name}</p>
            <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${text} ${bg} opacity-80`}>
              {score}
            </div>
          </div>
          <p className="text-[11px] text-text-muted font-medium mt-0.5">
            <span className="text-text-secondary">{property.regime ?? "LMNP"}</span> · {revenue?.monthly_rent ? `${fmt(revenue.monthly_rent)}€/mo` : "Sans loyer"}
          </p>
        </div>

        <div className="text-right shrink-0">
          <p className={`font-mono text-sm font-extrabold ${cfPositive ? "text-green" : "text-red"}`}>
            {cfPositive ? "+" : "−"}{fmt(cashflow)}<span className="text-xs ml-0.5">€</span>
          </p>
          <p className="text-[10px] text-text-muted font-bold uppercase tracking-tighter">Net / mois</p>
        </div>
        
        <div className="w-8 h-8 rounded-full bg-bg flex items-center justify-center text-border group-hover:text-accent group-hover:bg-accent/5 transition-all">
            <ChevronRight size={14} strokeWidth={2.5} />
        </div>
      </div>
    </Link>
  );
}

function ArticleSheet({ article, onClose }: { article: Article; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col justify-end"
      onClick={onClose}
      style={{ background: "rgba(11,11,26,0.8)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="bg-card border-t border-border rounded-t-3xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
        style={{ animation: "slideUp 0.3s cubic-bezier(0,0,0.2,1)" }}
      >
        <div className="sticky top-0 bg-card/80 backdrop-blur-md z-10 px-5 pt-4 pb-2">
          <div className="flex justify-center mb-4">
            <div className="w-10 h-1 bg-border rounded-full" />
          </div>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className={`text-[10px] font-bold uppercase tracking-widest ${article.color}`}>
                {article.category} · {article.type === "cours" ? "Formation" : "Actualité"}
              </span>
              <h2 className="text-lg font-bold text-text leading-tight">{article.title}</h2>
              <p className="text-xs text-text-secondary">{article.date}</p>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-bg border border-border flex items-center justify-center text-text-secondary hover:text-text transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        
        <div className="px-5 py-6 text-sm text-text-secondary leading-relaxed space-y-4">
          {article.content}
          
          <div className="mt-10 p-5 bg-accent/5 border border-accent/10 rounded-2xl text-center">
            <p className="text-xs font-bold text-text mb-2">Vous voulez aller plus loin ?</p>
            <p className="text-[11px] text-text-secondary mb-4">Inscrivez-vous à notre newsletter pour recevoir un conseil par semaine directement dans votre boîte mail.</p>
            <button className="w-full py-2.5 bg-accent text-white rounded-xl text-xs font-bold shadow-lg shadow-accent/20">
              S&apos;inscrire gratuitement
            </button>
          </div>
        </div>
        <div className="h-10" />
      </div>
    </div>
  );
}

// ── Bank Rates Section ────────────────────────────────────────

function BankRates() {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-text flex items-center gap-2">
          <Activity size={16} className="text-accent" />
          Taux du Marché
        </h2>
        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green/10 text-green rounded-full border border-green/20">
          <ArrowDown size={10} />
          <span className="text-[10px] font-bold">-0.15% ce mois</span>
        </div>
      </div>

      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-text-secondary border-b border-border/50">
              <th className="text-left font-medium py-2">Banque</th>
              <th className="text-center font-medium py-2">15 ans</th>
              <th className="text-center font-medium py-2">20 ans</th>
              <th className="text-center font-medium py-2">25 ans</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {MARKET_RATES.map((b) => (
              <tr key={b.bank} className="group hover:bg-bg/50 transition-colors">
                <td className="py-2.5 font-semibold text-text">{b.bank}</td>
                <td className="py-2.5 text-center text-text-secondary">{b.rate15}%</td>
                <td className="py-2.5 text-center text-accent font-bold">{b.rate20}%</td>
                <td className="py-2.5 text-center text-text-secondary">{b.rate25}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pt-2 flex items-center justify-between border-t border-border/50">
        <div className="flex items-center gap-1.5 text-[9px] text-text-muted italic">
          <Info size={10} />
          <span>Mise à jour : Aujourd&apos;hui (Sources agrégées)</span>
        </div>
        <Link href="/taux" className="text-[10px] font-bold text-accent">Comparer tout</Link>
      </div>
    </div>
  );
}

// ── News Section ─────────────────────────────────────────────

function NewsCard({
  article, onClick
}: {
  article: Article;
  onClick: (id: string) => void;
}) {
  const Icon = article.icon;
  return (
    <div 
      onClick={() => onClick(article.id)}
      className="bg-card border border-border/60 rounded-[24px] p-5 hover:border-accent/40 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group cursor-pointer relative overflow-hidden active:scale-[0.98]"
    >
      <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-accent/5 rounded-full blur-2xl group-hover:bg-accent/10 transition-colors" />
      
      <div className="flex gap-5 relative z-10">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border-2 transition-transform duration-500 group-hover:scale-110 ${article.color} bg-current/5`} style={{ borderColor: 'rgba(currentColor, 0.1)' }}>
          <Icon size={24} strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-[10px] font-extrabold uppercase tracking-[0.15em] ${article.color}`}>
              {article.category}
            </span>
            <span className="text-[10px] text-text-muted font-bold flex items-center gap-1">
                <CalendarRange size={10} />
                {article.date}
            </span>
          </div>
          <h3 className="text-base font-bold text-text leading-snug group-hover:text-accent transition-colors">
            {article.title}
          </h3>
          <div className="flex items-center gap-2 mt-3">
            <span className={`text-[9px] px-2 py-1 rounded-lg font-bold uppercase tracking-wider ${
              article.type === "cours" ? "bg-accent/10 text-accent border border-accent/20" : "bg-green/10 text-green border border-green/20"
            }`}>
              {article.type === "cours" ? "Formation" : "Actualité"}
            </span>
            <div className="flex items-center gap-1.5 text-[11px] text-accent font-bold ml-auto opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
              <span>Lire la suite</span>
              <ArrowUpRight size={12} strokeWidth={3} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NewsSection({ onArticleClick }: { onArticleClick: (id: string) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
            <div className="p-1.5 bg-accent/10 rounded-lg">
                <Newspaper size={18} className="text-accent" />
            </div>
            <h2 className="text-base font-extrabold text-text tracking-tight">Actualités & Conseils</h2>
        </div>
        <Link href="/conseils" className="text-xs text-accent font-bold hover:underline underline-offset-4">Tout voir</Link>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {NEWS_ARTICLES.map(art => (
          <NewsCard key={art.id} article={art} onClick={onArticleClick} />
        ))}
      </div>

      <div className="relative group overflow-hidden bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-[24px] p-6 shadow-xl shadow-indigo-500/20 active:scale-[0.99] transition-transform cursor-pointer">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
        
        <div className="flex items-center gap-5 relative z-10">
          <div className="w-14 h-14 rounded-[20px] bg-white/20 backdrop-blur-md flex items-center justify-center text-white shrink-0 border border-white/30 shadow-inner">
            <GraduationCap size={28} strokeWidth={1.5} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-extrabold text-white leading-tight">Académie Propfolio</p>
            <p className="text-[11px] text-indigo-100 mt-1 font-medium leading-relaxed">
              Devenez un expert de l&apos;investissement meublé avec nos mentors.
            </p>
          </div>
          <div className="px-4 py-2 bg-white text-indigo-900 rounded-xl text-xs font-bold shadow-lg shadow-black/10 hover:bg-indigo-50 transition-colors">
            Rejoindre
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────

export default function DashboardPage() {
  const tmi = useUserTmi();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeKpi, setActiveKpi] = useState<KpiKey | null>(null);
  const [activeArticleId, setActiveArticleId] = useState<string | null>(null);

  const activeArticle = NEWS_ARTICLES.find(a => a.id === activeArticleId);

  useEffect(() => {
    async function load() {
      const { data: properties } = await supabase
        .from("properties").select("*").order("created_at", { ascending: false });

      if (!properties?.length) { setLoading(false); return; }

      const ids = properties.map(p => p.id);
      const [{ data: loans }, { data: charges }, { data: revenues }] = await Promise.all([
        supabase.from("loans").select("property_id,amount,rate,duration_years,monthly_payment,remaining_capital").in("property_id", ids),
        supabase.from("charges").select("property_id,type,amount,frequency").in("property_id", ids),
        supabase.from("revenues").select("property_id,monthly_rent,vacancy_rate").in("property_id", ids),
      ]);

      setEntries(properties.map(p => {
        const loan = (loans?.find(l => l.property_id === p.id) as DashLoan) ?? null;
        const propCharges = (charges?.filter(c => c.property_id === p.id) as DashCharge[]) ?? [];
        const revenue = (revenues?.find(r => r.property_id === p.id) as DashRevenue) ?? null;
        return {
          property: p as Property, loan, charges: propCharges, revenue,
          cashflow: computeNetCashflow(p as Property, loan, propCharges, revenue, tmi),
          score: computeScoreDetails(p as Property, loan, propCharges, revenue, tmi).global,
        };
      }));
      setLoading(false);
    }
    load();
  }, [tmi]);

  if (loading) return <LoadingSkeleton />;

  // ── KPIs ────────────────────────────────────────────────────

  const patrimoineNet = entries.reduce((s, e) => s + e.property.current_value - (e.loan?.remaining_capital ?? 0), 0);
  const cashflowMensuel = entries.reduce((s, e) => s + e.cashflow, 0);

  const totalNetOperating = entries.reduce((s, e) => {
    const { taxeFonciere, copro, pno, gli, travaux } = getChargeAmounts(e.charges);
    const annualRent = (e.revenue?.monthly_rent ?? 0) * 12;
    const opex = taxeFonciere + copro + pno + gli + travaux;
    const tax = computeMonthlyTax(e.property.regime, annualRent, opex, e.loan, e.property.purchase_price, tmi) * 12;
    return s + annualRent - opex - tax;
  }, 0);

  const totalPurchasePrice = entries.reduce((s, e) => s + e.property.purchase_price, 0);
  const rendementNet = totalPurchasePrice > 0 ? (totalNetOperating / totalPurchasePrice) * 100 : 0;

  const projection10ans = entries.reduce((s, e) => {
    return s + e.property.current_value * Math.pow(1.02, 10) - (e.loan ? projectRemainingCapital(e.loan, 10) : 0);
  }, 0);

  const growthPct = patrimoineNet > 0
    ? ((patrimoineNet - patrimoineNet / Math.pow(1.015, 11)) / (patrimoineNet / Math.pow(1.015, 11))) * 100 : 0;

  function toggleKpi(k: KpiKey) {
    setActiveKpi(prev => prev === k ? null : k);
  }

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="relative min-h-screen bg-bg overflow-x-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 inset-x-0 h-[400px] bg-gradient-to-b from-accent/5 to-transparent pointer-events-none" />
      <div className="absolute top-20 right-[-10%] w-[40%] h-[20%] bg-accent/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-40 left-[-10%] w-[30%] h-[15%] bg-green/5 rounded-full blur-[100px] pointer-events-none" />
      
      <div className="relative px-4 pt-8 pb-12 max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-end justify-between px-1">
          <div className="space-y-1">
            <h1 className="text-2xl font-black text-text tracking-tight leading-none bg-gradient-to-r from-text to-text-secondary bg-clip-text text-transparent">Tableau de bord</h1>
            <div className="text-text-muted text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                Diagnostic Stratégique
            </div>
          </div>
          {entries.length > 0 && (
            <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-1.5 bg-green/10 text-green text-[10px] font-extrabold px-3 py-1.5 rounded-full border border-green/20 shadow-sm">
                    <TrendingUp size={12} strokeWidth={3} />
                    PV LATENTE +{growthPct.toFixed(1)}%
                </div>
                <span className="text-[9px] text-text-muted font-bold mr-1">Rendement pondéré</span>
            </div>
          )}
        </div>

      {entries.length === 0 ? <EmptyState /> : (
        <>
          {/* KPI grid */}
          <div className="grid grid-cols-2 gap-3">
            <KpiCard
              label="Patrimoine net" active={activeKpi === "patrimoine"}
              icon={Landmark} color="accent"
              value={fmtK(patrimoineNet).replace(/[€KM]/g, "").trim()}
              unit={Math.abs(patrimoineNet) >= 1_000_000 ? "M€" : Math.abs(patrimoineNet) >= 1_000 ? "K€" : "€"}
              sub="valeur − crédits"
              sparkData={Array.from({ length: 8 }, (_, i) => patrimoineNet / Math.pow(1.015, 7 - i))}
              onClick={() => toggleKpi("patrimoine")}
            />
            <KpiCard
              label="Cashflow mensuel" active={activeKpi === "cashflow"}
              icon={Wallet} color="green"
              value={`${cashflowMensuel >= 0 ? "+" : "−"}${fmt(cashflowMensuel)}`}
              unit="€/mo" sub="après charges & impôts"
              positive={cashflowMensuel >= 0}
              negative={cashflowMensuel < 0}
              sparkData={Array.from({ length: 8 }, (_, i) => cashflowMensuel * (0.85 + i * 0.02 + Math.sin(i) * 0.04))}
              onClick={() => toggleKpi("cashflow")}
            />
            <KpiCard
              label="Rendement net" active={activeKpi === "rendement"}
              icon={Percent} color="yellow"
              value={rendementNet.toFixed(1).replace(".", ",")}
              unit="%" sub="charges & fiscalité incluses"
              sparkData={Array.from({ length: 8 }, (_, i) => rendementNet * (0.92 + i * 0.012))}
              onClick={() => toggleKpi("rendement")}
            />
            <KpiCard
              label="Projection 10 ans" active={activeKpi === "projection"}
              icon={CalendarRange} color="accent"
              value={fmtK(projection10ans).replace(/[€KM]/g, "").trim()}
              unit={Math.abs(projection10ans) >= 1_000_000 ? "M€" : Math.abs(projection10ans) >= 1_000 ? "K€" : "€"}
              sub="hyp. revalorisation 2 %"
              sparkData={Array.from({ length: 8 }, (_, i) => projection10ans * (0.6 + i * 0.057))}
              onClick={() => toggleKpi("projection")}
            />
          </div>

          {/* Chart */}
          {patrimoineNet > 0 && (
            <PatrimoineChart patrimoine={patrimoineNet} />
          )}

          {/* Taux Bancaires */}
          <BankRates />

          {/* Property list */}
          <div className="bg-card rounded-2xl p-4 border border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-text">Mes biens</p>
              <Link href="/biens" className="text-[11px] text-accent font-medium">Voir tout</Link>
            </div>
            {entries.map(e => <PropertyRow key={e.property.id} entry={e} />)}
            <Link href="/biens/nouveau"
              className="mt-3 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-border text-xs font-medium text-text-secondary hover:text-text hover:border-accent/40 transition-colors">
              <Plus size={13} />Ajouter un bien
            </Link>
          </div>

          {/* Actualités Section */}
          <NewsSection onArticleClick={setActiveArticleId} />

          <p className="text-[11px] text-text-secondary text-center px-2 leading-relaxed">
            Calculs indicatifs (TMI 30 % par défaut). Consultez un expert-comptable.
          </p>
        </>
      )}

      {/* KPI Detail Sheet */}
      {activeKpi && (
        <KpiSheet
          kpi={activeKpi} entries={entries}
          patrimoine={patrimoineNet} cashflow={cashflowMensuel}
          rendement={rendementNet} projection={projection10ans}
          tmi={tmi}
          onClose={() => setActiveKpi(null)}
        />
      )}

      {/* Article Sheet */}
      {activeArticle && (
        <ArticleSheet
          article={activeArticle}
          onClose={() => setActiveArticleId(null)}
        />
      )}
    </div>
  </div>
);
}
