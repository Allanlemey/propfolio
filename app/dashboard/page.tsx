"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2, Home, Store, Warehouse, Building, Plus,
  ChevronRight, TrendingUp, X, TrendingDown, Percent,
  CalendarRange, Wallet,
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

function KpiCard({
  label, value, unit, sub, positive, onClick, active,
}: {
  label: string; value: string; unit: string; sub: string;
  positive?: boolean; onClick: () => void; active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`bg-card rounded-2xl p-4 border text-left flex flex-col gap-1 w-full transition-all active:scale-[0.97] ${
        active ? "border-accent/60 shadow-[0_0_0_1px_rgba(108,99,255,0.3)]" : "border-border hover:border-accent/30"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-text-secondary text-[10px] font-semibold tracking-wider uppercase">{label}</span>
        <ChevronRight size={12} className={`transition-colors ${active ? "text-accent" : "text-border"}`} />
      </div>
      <div className="flex items-baseline gap-1 mt-0.5">
        <span className={`font-mono font-bold text-[1.5rem] leading-tight ${positive ? "text-green" : "text-text"}`}>
          {value}
        </span>
        <span className={`font-mono text-sm ${positive ? "text-green" : "text-text-secondary"}`}>{unit}</span>
      </div>
      <span className="text-text-secondary text-[10px] leading-tight">{sub}</span>
    </button>
  );
}

// ── Chart ─────────────────────────────────────────────────────

function PatrimoineChart({
  patrimoine, activeBar, onBarClick,
}: {
  patrimoine: number; activeBar: number | null; onBarClick: (i: number | null) => void;
}) {
  const now = new Date();
  const chartData = Array.from({ length: 12 }, (_, i) => ({
    month: MONTHS_FR[new Date(now.getFullYear(), now.getMonth() - (11 - i), 1).getMonth()],
    year: new Date(now.getFullYear(), now.getMonth() - (11 - i), 1).getFullYear(),
    value: patrimoine / Math.pow(1.015, 11 - i),
  }));

  const growthPct = chartData[0].value > 0
    ? ((chartData[11].value - chartData[0].value) / chartData[0].value) * 100 : 0;

  const W = 560; const H = 150;
  const PAD = { top: 14, right: 8, bottom: 30, left: 46 };
  const values = chartData.map(d => d.value);
  const minVal = Math.min(...values) * 0.96;
  const maxVal = Math.max(...values) * 1.01;
  const range = maxVal - minVal || 1;
  const plotH = H - PAD.top - PAD.bottom;
  const plotW = W - PAD.left - PAD.right;
  const gap = plotW / values.length;
  const barW = gap * 0.52;
  const barY = (v: number) => PAD.top + plotH - ((v - minVal) / range) * plotH;
  const barH = (v: number) => Math.max(2, ((v - minVal) / range) * plotH);

  return (
    <div className="bg-card rounded-2xl p-4 border border-border">
      <div className="flex items-start justify-between mb-1">
        <div>
          <p className="text-sm font-semibold text-text">Évolution patrimoine net</p>
          <p className="text-[11px] text-text-secondary">
            {activeBar !== null
              ? `${chartData[activeBar].month} ${chartData[activeBar].year} — ${fmtK(chartData[activeBar].value)}`
              : "12 derniers mois — cliquez une barre"}
          </p>
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
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6C63FF" />
            <stop offset="100%" stopColor="#00D9A6" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 0.33, 0.67, 1].map((t, i) => {
          const y = PAD.top + plotH * (1 - t);
          return (
            <g key={i}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                stroke="var(--border)" strokeWidth={0.7} strokeDasharray="4 3" />
              <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize={9} fill="var(--text-secondary)">
                {Math.round((minVal + range * t) / 1000)}K
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {chartData.map((d, i) => {
          const isActive = activeBar === i;
          const isLast = i === chartData.length - 1;
          const dimmed = activeBar !== null && !isActive;
          const x = PAD.left + gap * i + (gap - barW) / 2;
          const bY = barY(d.value);
          const bH = barH(d.value);
          const delta = i > 0
            ? ((d.value - chartData[i - 1].value) / chartData[i - 1].value) * 100 : null;

          return (
            <g
              key={i}
              style={{ cursor: "pointer" }}
              onClick={() => onBarClick(isActive ? null : i)}
            >
              {/* Hit area */}
              <rect x={PAD.left + gap * i} y={PAD.top} width={gap} height={plotH + PAD.bottom}
                fill="transparent" />
              {/* Bar */}
              <rect
                x={x} y={bY} width={barW} height={bH} rx={3}
                fill={isActive || isLast ? "url(#barGrad)" : "var(--accent)"}
                opacity={dimmed ? 0.12 : isActive ? 1 : isLast ? 0.9 : 0.3}
                style={{ transition: "opacity 0.15s ease" }}
              />
              {/* Active highlight ring */}
              {isActive && (
                <rect x={x - 1} y={bY - 1} width={barW + 2} height={bH + 2} rx={4}
                  fill="none" stroke="url(#barGrad)" strokeWidth={1.5} opacity={0.6} />
              )}
              {/* Tooltip when active */}
              {isActive && (() => {
                const txw = 72; const txh = delta !== null ? 28 : 18;
                const tx = Math.min(Math.max(x + barW / 2 - txw / 2, PAD.left), W - PAD.right - txw);
                const ty = bY - txh - 8;
                return (
                  <g>
                    <rect x={tx} y={ty} width={txw} height={txh} rx={6}
                      fill="var(--card)" stroke="var(--accent)" strokeWidth={0.8} opacity={0.95} />
                    <text x={tx + txw / 2} y={ty + 11} textAnchor="middle" fontSize={9}
                      fill="var(--text)" fontWeight={700}>
                      {fmtK(d.value)}
                    </text>
                    {delta !== null && (
                      <text x={tx + txw / 2} y={ty + 22} textAnchor="middle" fontSize={8}
                        fill={delta >= 0 ? "#00D9A6" : "#FF6B6B"}>
                        {delta >= 0 ? "+" : ""}{delta.toFixed(1)} % vs préc.
                      </text>
                    )}
                    {/* Arrow */}
                    <polygon
                      points={`${x + barW / 2 - 4},${bY - 2} ${x + barW / 2 + 4},${bY - 2} ${x + barW / 2},${bY + 3}`}
                      fill="var(--accent)" opacity={0.6}
                    />
                  </g>
                );
              })()}
              {/* Month label */}
              <text
                x={x + barW / 2} y={H - PAD.bottom + 14}
                textAnchor="middle" fontSize={9}
                fill={isActive ? "var(--accent)" : isLast ? "var(--text)" : "var(--text-secondary)"}
                fontWeight={isActive || isLast ? 700 : 400}
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

// ── KPI Detail Sheet ──────────────────────────────────────────

function KpiSheet({
  kpi, entries, patrimoine, cashflow, rendement, projection, onClose,
}: {
  kpi: KpiKey; entries: Entry[];
  patrimoine: number; cashflow: number; rendement: number; projection: number;
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
                const tax = computeMonthlyTax(e.property.regime, annualRent, opex, e.loan, e.property.purchase_price) * 12;
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
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBar, setActiveBar] = useState<number | null>(null);
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
          cashflow: computeNetCashflow(p as Property, loan, propCharges, revenue),
          score: computeScoreDetails(p as Property, loan, propCharges, revenue).global,
        };
      }));
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <LoadingSkeleton />;

  // ── KPIs ────────────────────────────────────────────────────

  const patrimoineNet = entries.reduce((s, e) => s + e.property.current_value - (e.loan?.remaining_capital ?? 0), 0);
  const cashflowMensuel = entries.reduce((s, e) => s + e.cashflow, 0);

  const totalNetOperating = entries.reduce((s, e) => {
    const { taxeFonciere, copro, pno, gli, travaux } = getChargeAmounts(e.charges);
    const annualRent = (e.revenue?.monthly_rent ?? 0) * 12;
    const opex = taxeFonciere + copro + pno + gli + travaux;
    const tax = computeMonthlyTax(e.property.regime, annualRent, opex, e.loan, e.property.purchase_price) * 12;
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
              value={fmtK(patrimoineNet).replace(/[€KM]/g, "").trim()}
              unit={Math.abs(patrimoineNet) >= 1_000_000 ? "M€" : Math.abs(patrimoineNet) >= 1_000 ? "K€" : "€"}
              sub="valeur − crédits"
              onClick={() => toggleKpi("patrimoine")}
            />
            <KpiCard
              label="Cashflow mensuel" active={activeKpi === "cashflow"}
              value={`${cashflowMensuel >= 0 ? "+" : "−"}${fmt(cashflowMensuel)}`}
              unit="€/mo" sub="après charges & impôts"
              positive={cashflowMensuel >= 0}
              onClick={() => toggleKpi("cashflow")}
            />
            <KpiCard
              label="Rendement net" active={activeKpi === "rendement"}
              value={rendementNet.toFixed(1).replace(".", ",")}
              unit="%" sub="charges & fiscalité incluses"
              onClick={() => toggleKpi("rendement")}
            />
            <KpiCard
              label="Projection 10 ans" active={activeKpi === "projection"}
              value={fmtK(projection10ans).replace(/[€KM]/g, "").trim()}
              unit={Math.abs(projection10ans) >= 1_000_000 ? "M€" : Math.abs(projection10ans) >= 1_000 ? "K€" : "€"}
              sub="hyp. revalorisation 2 %"
              onClick={() => toggleKpi("projection")}
            />
          </div>

          {/* Chart */}
          {patrimoineNet > 0 && (
            <PatrimoineChart
              patrimoine={patrimoineNet}
              activeBar={activeBar}
              onBarClick={setActiveBar}
            />
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
          onClose={() => setActiveKpi(null)}
        />
      )}
    </div>
  );
}
