"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useUserTmi } from "@/hooks/use-user-tmi";
import Link from "next/link";
import {
  Building2, Home, Store, Warehouse, Building, Plus,
  ChevronRight, TrendingUp, X, TrendingDown, Percent,
  CalendarRange, Wallet, Landmark, ArrowUpRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  computeNetCashflow, computeScoreDetails,
  getChargeAmounts, computeMonthlyTax, projectRemainingCapital,
} from "@/lib/calculations";
import type { Property, Loan, Charge, Revenue } from "@/lib/calculations";

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

const KPI_COLORS: Record<KpiColor, { main: string; glow: string; bg: string; border: string; grad1: string; grad2: string }> = {
  accent:  { main: "#6C63FF", glow: "rgba(108,99,255,0.25)", bg: "rgba(108,99,255,0.08)", border: "rgba(108,99,255,0.25)", grad1: "#6C63FF", grad2: "#8B83FF" },
  green:   { main: "#00D9A6", glow: "rgba(0,217,166,0.25)",  bg: "rgba(0,217,166,0.08)",  border: "rgba(0,217,166,0.25)",  grad1: "#00D9A6", grad2: "#00F0BB" },
  yellow:  { main: "#FBBF24", glow: "rgba(251,191,36,0.25)", bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.25)", grad1: "#FBBF24", grad2: "#FCD34D" },
  red:     { main: "#FF6B6B", glow: "rgba(255,107,107,0.25)",bg: "rgba(255,107,107,0.08)",border: "rgba(255,107,107,0.25)",grad1: "#FF6B6B", grad2: "#FF8787" },
};

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const w = 56;
  const h = 22;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: h - ((v - min) / range) * (h - 4) - 2,
  }));

  let path = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const cp = (pts[i + 1].x - pts[i].x) * 0.35;
    path += ` C${pts[i].x + cp},${pts[i].y} ${pts[i + 1].x - cp},${pts[i + 1].y} ${pts[i + 1].x},${pts[i + 1].y}`;
  }

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0" style={{ opacity: 0.7 }}>
      <path d={path} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r={2} fill={color} />
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
      className={`relative overflow-hidden bg-card rounded-2xl p-4 text-left flex flex-col gap-1.5 w-full transition-all duration-200 active:scale-[0.97] border ${
        active
          ? "shadow-[0_0_16px_rgba(108,99,255,0.2)]"
          : "hover:shadow-[0_2px_12px_rgba(0,0,0,0.08)]"
      }`}
      style={{
        borderColor: active ? c.main : undefined,
      }}
    >
      {/* Gradient top bar */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px]"
        style={{
          background: `linear-gradient(90deg, ${c.grad1}, ${c.grad2})`,
          opacity: active ? 1 : 0.5,
          transition: "opacity 0.2s ease",
        }}
      />

      {/* Header: icon + label + chevron */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div
            className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
            style={{ background: c.bg, border: `1px solid ${c.border}` }}
          >
            <Icon size={10} style={{ color: c.main }} strokeWidth={2.2} />
          </div>
          <span className="text-text-secondary text-[10px] font-semibold tracking-wider uppercase">{label}</span>
        </div>
        <ChevronRight size={11} className={`transition-colors ${active ? "text-accent" : "text-border"}`} />
      </div>

      {/* Value row + sparkline */}
      <div className="flex items-end justify-between gap-2">
        <div className="flex items-baseline gap-1 min-w-0">
          <span className={`font-mono font-bold text-[1.45rem] leading-none tracking-tight ${valueColor}`}>
            {value}
          </span>
          <span className={`font-mono text-[11px] font-medium ${
            negative ? "text-red/70" : positive ? "text-green/70" : "text-text-secondary"
          }`}>
            {unit}
          </span>
        </div>
        {sparkData && <MiniSparkline data={sparkData} color={c.main} />}
      </div>

      {/* Subtitle */}
      <span className="text-text-secondary text-[10px] leading-tight">{sub}</span>
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
      year: d.getFullYear(),
      value: patrimoine / Math.pow(growth, months - 1 - i),
    };
  });

  const first = chartData[0].value;
  const last = chartData[chartData.length - 1].value;
  const growthPct = first > 0 ? ((last - first) / first) * 100 : 0;

  // SVG dimensions
  const W = 580;
  const H = 200;
  const PAD = { top: 24, right: 12, bottom: 32, left: 50 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const values = chartData.map(d => d.value);
  const minVal = Math.min(...values) * 0.97;
  const maxVal = Math.max(...values) * 1.02;
  const valRange = maxVal - minVal || 1;

  const xOf = (i: number) => PAD.left + (i / (chartData.length - 1)) * plotW;
  const yOf = (v: number) => PAD.top + plotH - ((v - minVal) / valRange) * plotH;

  // Smooth bezier path
  const points = chartData.map((d, i) => ({ x: xOf(i), y: yOf(d.value) }));

  function bezierPath(pts: { x: number; y: number }[]): string {
    if (pts.length < 2) return "";
    let path = `M${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const cp = (pts[i + 1].x - pts[i].x) * 0.35;
      path += ` C${pts[i].x + cp},${pts[i].y} ${pts[i + 1].x - cp},${pts[i + 1].y} ${pts[i + 1].x},${pts[i + 1].y}`;
    }
    return path;
  }

  const linePath = bezierPath(points);
  const areaPath = `${linePath} L${points[points.length - 1].x},${PAD.top + plotH} L${points[0].x},${PAD.top + plotH} Z`;

  // X-axis labels: show a subset to avoid clutter
  const labelStep = months <= 12 ? 1 : months <= 24 ? 2 : 6;
  const xLabels = chartData
    .map((d, i) => ({ ...d, i }))
    .filter((_, i) => i % labelStep === 0 || i === chartData.length - 1);

  // Hover handler
  const onMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    // Find nearest point
    let nearest = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const dist = Math.abs(points[i].x - mx);
      if (dist < nearestDist) { nearestDist = dist; nearest = i; }
    }
    setHoverIdx(nearest);
  }, [points]);

  const hoverPoint = hoverIdx !== null ? chartData[hoverIdx] : null;
  const hoverDelta = hoverIdx !== null && hoverIdx > 0
    ? ((chartData[hoverIdx].value - chartData[hoverIdx - 1].value) / chartData[hoverIdx - 1].value) * 100
    : null;

  return (
    <div className="bg-card rounded-2xl p-4 border border-border">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-text">Évolution patrimoine net</p>
          <p className="text-[11px] text-text-secondary mt-0.5">
            {hoverPoint
              ? `${hoverPoint.label} ${months > 12 ? "" : hoverPoint.year} — ${fmtK(hoverPoint.value)}`
              : "Survolez le graphique"}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-green/10 text-green text-[11px] font-semibold px-2.5 py-1 rounded-full border border-green/20">
          <TrendingUp size={10} strokeWidth={2.5} />
          +{growthPct.toFixed(1)} %
        </div>
      </div>

      {/* Range selector */}
      <div className="flex items-center gap-1 mb-3">
        {(["6M", "1A", "2A", "5A"] as RangeKey[]).map(r => (
          <button
            key={r}
            onClick={() => { setRange(r); setHoverIdx(null); }}
            className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-all duration-200 ${
              range === r
                ? "bg-accent text-white shadow-[0_2px_8px_rgba(108,99,255,0.35)]"
                : "bg-bg text-text-secondary hover:text-text border border-border hover:border-accent/30"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Chart */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: 200 }}
        aria-label={`Évolution patrimoine net sur ${months} mois`}
        onMouseMove={onMouseMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6C63FF" stopOpacity={0.35} />
            <stop offset="85%" stopColor="#6C63FF" stopOpacity={0.02} />
            <stop offset="100%" stopColor="#6C63FF" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#6C63FF" />
            <stop offset="100%" stopColor="#00D9A6" />
          </linearGradient>
          <filter id="lineGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
          const y = PAD.top + plotH * (1 - t);
          return (
            <g key={i}>
              <line
                x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                stroke="var(--border)" strokeWidth={0.5} strokeDasharray="3 4"
              />
              <text x={PAD.left - 8} y={y + 3.5} textAnchor="end" fontSize={8.5}
                fill="var(--text-secondary)" fontFamily="'Space Mono', monospace">
                {fmtK(minVal + valRange * t)}
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        <path d={areaPath} fill="url(#areaGrad)" />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="url(#lineGrad)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#lineGlow)"
        />

        {/* End-point dot */}
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r={4}
          fill="#00D9A6"
          stroke="var(--card)"
          strokeWidth={2}
        />
        {/* Animated pulse on last point */}
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r={4}
          fill="none"
          stroke="#00D9A6"
          strokeWidth={1.5}
          opacity={0.4}
        >
          <animate attributeName="r" from="4" to="14" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" from="0.5" to="0" dur="2s" repeatCount="indefinite" />
        </circle>

        {/* X-axis labels */}
        {xLabels.map(d => (
          <text
            key={d.i}
            x={xOf(d.i)}
            y={H - PAD.bottom + 16}
            textAnchor="middle"
            fontSize={8.5}
            fill="var(--text-secondary)"
            fontFamily="'Space Mono', monospace"
          >
            {d.shortLabel}
          </text>
        ))}

        {/* Hover crosshair + tooltip */}
        {hoverIdx !== null && (() => {
          const px = points[hoverIdx].x;
          const py = points[hoverIdx].y;
          const txw = 90;
          const txh = hoverDelta !== null ? 38 : 24;
          const tx = Math.min(Math.max(px - txw / 2, PAD.left), W - PAD.right - txw);
          const ty = Math.max(py - txh - 14, PAD.top);
          return (
            <g>
              {/* Vertical line */}
              <line x1={px} y1={PAD.top} x2={px} y2={PAD.top + plotH}
                stroke="var(--accent)" strokeWidth={0.8} strokeDasharray="3 3" opacity={0.5} />
              {/* Horizontal line */}
              <line x1={PAD.left} y1={py} x2={W - PAD.right} y2={py}
                stroke="var(--accent)" strokeWidth={0.5} strokeDasharray="3 3" opacity={0.25} />
              {/* Dot */}
              <circle cx={px} cy={py} r={5} fill="url(#lineGrad)" stroke="var(--card)" strokeWidth={2.5} />
              <circle cx={px} cy={py} r={3} fill="#fff" opacity={0.9} />
              {/* Tooltip card */}
              <rect x={tx} y={ty} width={txw} height={txh} rx={10}
                fill="var(--card)" stroke="var(--accent)" strokeWidth={0.7} opacity={0.96} />
              <text x={tx + txw / 2} y={ty + 14} textAnchor="middle" fontSize={10}
                fill="var(--text)" fontWeight={700} fontFamily="'Space Mono', monospace">
                {fmtK(chartData[hoverIdx].value)}
              </text>
              {hoverDelta !== null && (
                <text x={tx + txw / 2} y={ty + 28} textAnchor="middle" fontSize={8.5}
                  fill={hoverDelta >= 0 ? "#00D9A6" : "#FF6B6B"} fontWeight={600}>
                  {hoverDelta >= 0 ? "+" : ""}{hoverDelta.toFixed(1)} % vs préc.
                </text>
              )}
            </g>
          );
        })()}
      </svg>
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
      <div className="flex items-center gap-3 py-3.5 border-b border-border last:border-0 hover:bg-bg/50 -mx-1 px-1 rounded-lg transition-colors active:scale-[0.99]">
        <div className="w-10 h-10 rounded-xl bg-bg flex items-center justify-center text-accent shrink-0 border border-border">
          <Icon size={18} strokeWidth={1.8} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text truncate">{property.name}</p>
          <p className="text-[11px] text-text-secondary">
            {property.regime ?? "LMNP"} · {revenue?.monthly_rent ? `${fmt(revenue.monthly_rent)} €/mo` : "Pas de loyer"}
          </p>
        </div>
        <div className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${text} ${bg}`}>
          {score}/100
        </div>
        <div className={`font-mono text-sm font-bold w-[4.5rem] text-right shrink-0 ${cfPositive ? "text-green" : "text-red"}`}>
          {cfPositive ? "+" : "−"}{fmt(cashflow)} €
        </div>
        <ChevronRight size={14} className="text-text-secondary shrink-0" />
      </div>
    </Link>
  );
}

// ── Page ─────────────────────────────────────────────────────

export default function DashboardPage() {
  const tmi = useUserTmi();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeKpi, setActiveKpi] = useState<KpiKey | null>(null);

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
    <div className="px-4 pt-5 pb-8 max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-text leading-tight">Vue d&apos;ensemble</h1>
          <p className="text-text-secondary text-sm mt-0.5">
            {entries.length === 0
              ? "Aucun bien suivi"
              : `${entries.length} bien${entries.length > 1 ? "s" : ""} suivi${entries.length > 1 ? "s" : ""}`}
          </p>
        </div>
        {entries.length > 0 && (
          <div className="flex items-center gap-1.5 bg-green/10 text-green text-xs font-semibold px-3 py-1.5 rounded-full border border-green/20">
            <TrendingUp size={12} strokeWidth={2.5} />
            +{growthPct.toFixed(1)} % / an
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
    </div>
  );
}
