"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Info, Pencil, Trash2, X, Check, ChevronDown, TrendingUp, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  getChargeAmounts,
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

// ── Edit Form type ────────────────────────────────────────────

type EditForm = {
  name: string;
  address: string;
  type: string;
  surface: string;
  purchase_price: string;
  current_value: string;
  purchase_date: string;
  regime: string;
  monthly_rent: string;
  vacancy_rate: string;
  taxe_fonciere: string;
  copro: string;
  pno: string;
  gli: string;
  travaux: string;
  loan_amount: string;
  loan_rate: string;
  loan_duration: string;
  loan_monthly: string;
  loan_remaining: string;
};

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

type MarketData = {
  prixM2: number;
  min: number;
  max: number;
  count: number;
  city: string;
  lastUpdate: string | null;
} | null;

function TabOverview({
  property,
  loan,
  marketData,
  marketLoading,
}: {
  property: Property;
  loan: Loan | null;
  marketData: MarketData;
  marketLoading: boolean;
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

  const remainingMonths = (() => {
    if (!loan || !loan.remaining_capital || !loan.monthly_payment) return null;
    const r = (loan.rate ?? 0) / 100 / 12;
    const rem = loan.remaining_capital ?? 0;
    const pmt = loan.monthly_payment;
    if (pmt <= 0) return null;
    if (r === 0) return Math.round(rem / pmt);
    const val = 1 - (r * rem) / pmt;
    if (val <= 0) return null;
    return Math.round(-Math.log(val) / Math.log(1 + r));
  })();

  const remainingMonthsLabel = (() => {
    if (remainingMonths === null) return null;
    const y = Math.floor(remainingMonths / 12);
    const m = remainingMonths % 12;
    if (y === 0) return `${m} mois`;
    if (m === 0) return `${y} an${y > 1 ? "s" : ""}`;
    return `${y} an${y > 1 ? "s" : ""} ${m} mois`;
  })();

  const endDate = (() => {
    if (remainingMonths === null) return null;
    const d = new Date();
    d.setMonth(d.getMonth() + remainingMonths);
    return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  })();

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

      {/* Prix marché */}
      {(marketLoading || marketData) && (
        <div className="bg-card rounded-2xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={14} className="text-accent" />
            <p className="text-sm font-semibold text-text">Prix du marché local</p>
          </div>

          {marketLoading ? (
            <div className="flex items-center gap-2 py-1">
              <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
              <span className="text-xs text-text-secondary">Chargement des données DVF…</span>
            </div>
          ) : marketData ? (
            <>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="font-mono font-bold text-2xl text-text">
                  {marketData.prixM2.toLocaleString("fr-FR")} €
                </span>
                <span className="text-sm text-text-secondary">/m² à {marketData.city}</span>
              </div>
              <p className="text-[11px] text-text-secondary mb-3">
                {marketData.min.toLocaleString("fr-FR")} – {marketData.max.toLocaleString("fr-FR")} €/m²
                &nbsp;·&nbsp;{marketData.count} ventes
                {marketData.lastUpdate ? ` · ${marketData.lastUpdate}` : ""}
                &nbsp;· Source DVF data.gouv.fr
              </p>

              {property.surface && property.surface > 0 && (() => {
                const propM2 = property.current_value / property.surface;
                const delta = ((propM2 - marketData.prixM2) / marketData.prixM2) * 100;
                const isAbove = delta > 5;
                const isBelow = delta < -5;
                return (
                  <div className={`rounded-xl p-3 flex items-center justify-between ${
                    isAbove ? "bg-green/8 border border-green/20"
                    : isBelow ? "bg-accent/8 border border-accent/20"
                    : "bg-border/30 border border-border"
                  }`}>
                    <div>
                      <p className={`text-xs font-semibold ${isAbove ? "text-green" : isBelow ? "text-accent" : "text-text-secondary"}`}>
                        {isAbove ? "Au-dessus du marché" : isBelow ? "Potentiel de revalorisation" : "Dans les prix du marché"}
                      </p>
                      <p className="text-[11px] text-text-secondary mt-0.5">
                        Votre bien : {Math.round(propM2).toLocaleString("fr-FR")} €/m²
                      </p>
                    </div>
                    <span className={`font-mono font-bold text-lg ${isAbove ? "text-green" : isBelow ? "text-accent" : "text-text"}`}>
                      {delta > 0 ? "+" : ""}{delta.toFixed(1)}%
                    </span>
                  </div>
                );
              })()}
            </>
          ) : null}
        </div>
      )}

      {/* Crédit */}
      {loan ? (
        <div className="bg-card rounded-2xl p-4 border border-border space-y-3">
          <p className="text-sm font-semibold text-text">Crédit immobilier</p>
          {[
            { label: "Montant initial", value: `${fmt(loan.amount ?? 0)} €` },
            { label: "Taux", value: `${loan.rate ?? 0} %` },
            { label: "Durée totale", value: `${loan.duration_years ?? 0} ans` },
            { label: "Mensualité", value: `${fmt(loan.monthly_payment)} €/mois` },
            { label: "Capital restant dû", value: `${fmt(loan.remaining_capital ?? 0)} €` },
          ].map((row) => (
            <div key={row.label} className="flex justify-between items-center">
              <span className="text-sm text-text-secondary">{row.label}</span>
              <span className="text-sm font-mono text-text">{row.value}</span>
            </div>
          ))}

          {remainingMonthsLabel && (
            <div className="flex justify-between items-center py-2 px-3 bg-accent/6 rounded-xl border border-accent/20">
              <span className="text-sm text-text-secondary">Mensualités restantes</span>
              <div className="text-right">
                <span className="text-sm font-mono font-bold text-accent">
                  {remainingMonths} mois
                </span>
                <span className="text-[10px] text-text-secondary block">
                  {remainingMonthsLabel}{endDate ? ` · fin ${endDate}` : ""}
                </span>
              </div>
            </div>
          )}

          <div>
            <div className="flex justify-between text-xs text-text-secondary mb-1.5">
              <span>Remboursement</span>
              <span className="font-semibold text-text">{loanProgress} % remboursé</span>
            </div>
            <div className="h-2.5 bg-border rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${loanProgress}%`,
                  background: "linear-gradient(to right, #6C63FF, #00D9A6)",
                }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-text-secondary mt-1">
              <span>{fmt(loan.amount ?? 0)} € emprunté</span>
              <span>{fmt(loan.remaining_capital ?? 0)} € restant</span>
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
      <div className="bg-card rounded-2xl p-6 border border-border flex flex-col items-center gap-3">
        <ScoreRing score={scores.global} size={140} />
        <p className="text-sm text-text-secondary text-center max-w-xs">
          {scoreSummary(
            scores.global,
            scores.cashflow > 55 ? 1 : -1
          )}
        </p>
      </div>

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

// ── Prix m² estimation result type ───────────────────────────

type PrixEstResult = {
  prixM2: number;
  min: number;
  max: number;
  count: number;
  city: string;
  radiusKm: number;
  lastUpdate: string | null;
};

// ── Edit Sheet ────────────────────────────────────────────────

function EditSheet({
  open,
  onClose,
  form,
  onChange,
  onSave,
  saving,
  hasLoan,
}: {
  open: boolean;
  onClose: () => void;
  form: EditForm;
  onChange: (key: keyof EditForm, value: string) => void;
  onSave: () => void;
  saving: boolean;
  hasLoan: boolean;
}) {
  const REGIME_OPTIONS = [
    "LMNP micro-BIC",
    "LMNP réel simplifié",
    "Location nue micro-foncier",
    "Location nue régime réel",
  ];

  const TYPE_OPTIONS = [
    { value: "appartement", label: "Appartement" },
    { value: "maison", label: "Maison" },
    { value: "studio", label: "Studio" },
    { value: "immeuble", label: "Immeuble" },
    { value: "commercial", label: "Local commercial" },
  ];

  const [prixEst, setPrixEst] = useState<PrixEstResult | null>(null);
  const [estimLoading, setEstimLoading] = useState(false);
  const [estimError, setEstimError] = useState<string | null>(null);

  async function estimatePrix() {
    if (!form.address || form.address.trim().length < 5) return;
    setEstimLoading(true);
    setEstimError(null);
    setPrixEst(null);
    try {
      const res = await fetch(`/api/prix-m2?address=${encodeURIComponent(form.address)}`);
      const data = await res.json();
      if (res.ok) {
        setPrixEst(data);
      } else {
        setEstimError(data.error ?? "Données indisponibles pour cette adresse");
      }
    } catch {
      setEstimError("Erreur réseau");
    } finally {
      setEstimLoading(false);
    }
  }

  const inputClass =
    "w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-accent transition-colors";
  const labelClass = "block text-xs text-text-secondary mb-1.5 font-medium";

  return (
    <>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <div
            className="relative bg-card rounded-t-3xl border-t border-border max-h-[92vh] flex flex-col"
            style={{ animation: "slideUp 0.3s ease-out" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border shrink-0">
              <p className="text-base font-bold text-text">Modifier le bien</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={onSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white rounded-xl text-sm font-semibold disabled:opacity-50"
                >
                  {saving ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Check size={14} />
                  )}
                  Enregistrer
                </button>
                <button
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-xl bg-bg border border-border text-text-secondary"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-6">
              {/* Section: Bien */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-text-secondary mb-3">
                  Informations du bien
                </p>
                <div className="space-y-3">
                  <div>
                    <label className={labelClass}>Nom du bien</label>
                    <input
                      className={inputClass}
                      value={form.name}
                      onChange={(e) => onChange("name", e.target.value)}
                      placeholder="Ex: Studio Paris 11e"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Type de bien</label>
                    <div className="relative">
                      <select
                        className={`${inputClass} appearance-none pr-8`}
                        value={form.type}
                        onChange={(e) => onChange("type", e.target.value)}
                      >
                        {TYPE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Surface (m²)</label>
                    <input
                      className={inputClass}
                      type="number"
                      value={form.surface}
                      onChange={(e) => onChange("surface", e.target.value)}
                      placeholder="Ex: 32"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Adresse complète</label>
                    <div className="flex gap-2">
                      <input
                        className={inputClass}
                        value={form.address}
                        onChange={(e) => {
                          onChange("address", e.target.value);
                          setPrixEst(null);
                          setEstimError(null);
                        }}
                        placeholder="Ex: 12 rue de la Paix, 75001 Paris"
                      />
                      <button
                        type="button"
                        onClick={estimatePrix}
                        disabled={estimLoading || form.address.trim().length < 5}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 bg-accent/10 border border-accent/30 text-accent rounded-xl text-xs font-semibold hover:bg-accent/20 transition-colors disabled:opacity-40"
                        title="Estimer le prix du marché"
                      >
                        {estimLoading ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <TrendingUp size={13} />
                        )}
                        <span className="hidden sm:inline">Marché</span>
                      </button>
                    </div>

                    {/* Estimation result */}
                    {prixEst && (
                      <div className="mt-2 p-3 bg-accent/5 border border-accent/20 rounded-xl">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-accent">
                            Prix marché — {prixEst.city}
                          </span>
                          <span className="text-[10px] text-text-secondary">
                            {prixEst.radiusKm} km · {prixEst.count} ventes
                          </span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="font-mono font-bold text-lg text-text">
                            {prixEst.prixM2.toLocaleString("fr-FR")} €/m²
                          </span>
                          <span className="text-[11px] text-text-secondary">
                            ({prixEst.min.toLocaleString("fr-FR")} – {prixEst.max.toLocaleString("fr-FR")} €/m²)
                          </span>
                        </div>
                        {prixEst.lastUpdate && (
                          <p className="text-[10px] text-text-secondary mt-1">
                            Dernière transaction : {prixEst.lastUpdate} · Source : DVF data.gouv.fr
                          </p>
                        )}
                        {form.surface && parseFloat(form.surface) > 0 && (
                          <div className="mt-2 pt-2 border-t border-accent/15 flex justify-between">
                            <span className="text-xs text-text-secondary">
                              Estimation pour {form.surface} m²
                            </span>
                            <span className="text-xs font-mono font-bold text-green">
                              ~{Math.round(prixEst.prixM2 * parseFloat(form.surface)).toLocaleString("fr-FR")} €
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Estimation error */}
                    {estimError && (
                      <p className="mt-2 text-[11px] text-red px-1">{estimError}</p>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>Date d&apos;achat</label>
                    <input
                      className={inputClass}
                      type="date"
                      value={form.purchase_date}
                      onChange={(e) => onChange("purchase_date", e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Prix d&apos;achat (€)</label>
                      <input
                        className={inputClass}
                        type="number"
                        value={form.purchase_price}
                        onChange={(e) => onChange("purchase_price", e.target.value)}
                        placeholder="150000"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Valeur actuelle (€)</label>
                      <input
                        className={inputClass}
                        type="number"
                        value={form.current_value}
                        onChange={(e) => onChange("current_value", e.target.value)}
                        placeholder="160000"
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Régime fiscal</label>
                    <div className="relative">
                      <select
                        className={`${inputClass} appearance-none pr-8`}
                        value={form.regime}
                        onChange={(e) => onChange("regime", e.target.value)}
                      >
                        <option value="">-- Choisir --</option>
                        {REGIME_OPTIONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section: Revenus */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-text-secondary mb-3">
                  Revenus locatifs
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Loyer mensuel (€)</label>
                    <input
                      className={inputClass}
                      type="number"
                      value={form.monthly_rent}
                      onChange={(e) => onChange("monthly_rent", e.target.value)}
                      placeholder="800"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Taux de vacance (%)</label>
                    <input
                      className={inputClass}
                      type="number"
                      value={form.vacancy_rate}
                      onChange={(e) => onChange("vacancy_rate", e.target.value)}
                      placeholder="8"
                    />
                  </div>
                </div>
              </div>

              {/* Section: Charges */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-text-secondary mb-3">
                  Charges annuelles (€/an)
                </p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Taxe foncière</label>
                      <input
                        className={inputClass}
                        type="number"
                        value={form.taxe_fonciere}
                        onChange={(e) => onChange("taxe_fonciere", e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Charges copro</label>
                      <input
                        className={inputClass}
                        type="number"
                        value={form.copro}
                        onChange={(e) => onChange("copro", e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Assurance PNO</label>
                      <input
                        className={inputClass}
                        type="number"
                        value={form.pno}
                        onChange={(e) => onChange("pno", e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Assurance GLI</label>
                      <input
                        className={inputClass}
                        type="number"
                        value={form.gli}
                        onChange={(e) => onChange("gli", e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Provision travaux</label>
                    <input
                      className={inputClass}
                      type="number"
                      value={form.travaux}
                      onChange={(e) => onChange("travaux", e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              {/* Section: Crédit */}
              {hasLoan && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-text-secondary mb-3">
                    Crédit immobilier
                  </p>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>Montant emprunté (€)</label>
                        <input
                          className={inputClass}
                          type="number"
                          value={form.loan_amount}
                          onChange={(e) => onChange("loan_amount", e.target.value)}
                          placeholder="120000"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Taux (%)</label>
                        <input
                          className={inputClass}
                          type="number"
                          step="0.01"
                          value={form.loan_rate}
                          onChange={(e) => onChange("loan_rate", e.target.value)}
                          placeholder="3.5"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>Durée (ans)</label>
                        <input
                          className={inputClass}
                          type="number"
                          value={form.loan_duration}
                          onChange={(e) => onChange("loan_duration", e.target.value)}
                          placeholder="20"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Mensualité (€)</label>
                        <input
                          className={inputClass}
                          type="number"
                          value={form.loan_monthly}
                          onChange={(e) => onChange("loan_monthly", e.target.value)}
                          placeholder="680"
                        />
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Capital restant dû (€)</label>
                      <input
                        className={inputClass}
                        type="number"
                        value={form.loan_remaining}
                        onChange={(e) => onChange("loan_remaining", e.target.value)}
                        placeholder="95000"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="h-4" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Delete Modal ──────────────────────────────────────────────

function DeleteModal({
  open,
  propertyName,
  onConfirm,
  onCancel,
  deleting,
}: {
  open: boolean;
  propertyName: string;
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative bg-card rounded-2xl border border-border p-6 max-w-sm w-full shadow-2xl">
        <div className="w-12 h-12 rounded-2xl bg-red/15 flex items-center justify-center mx-auto mb-4">
          <Trash2 size={20} className="text-red" />
        </div>
        <p className="text-base font-bold text-text text-center mb-1">
          Supprimer ce bien ?
        </p>
        <p className="text-sm text-text-secondary text-center leading-relaxed mb-6">
          <span className="font-semibold text-text">{propertyName}</span> et
          toutes les données associées (crédit, charges, revenus) seront
          définitivement supprimées.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-text-secondary hover:bg-bg transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 py-2.5 rounded-xl bg-red text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {deleting ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              "Supprimer"
            )}
          </button>
        </div>
      </div>
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
  const [marketData, setMarketData] = useState<MarketData>(null);
  const [marketLoading, setMarketLoading] = useState(false);

  // Edit / delete state
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    name: "",
    address: "",
    type: "appartement",
    surface: "",
    purchase_price: "",
    current_value: "",
    purchase_date: "",
    regime: "",
    monthly_rent: "",
    vacancy_rate: "8",
    taxe_fonciere: "",
    copro: "",
    pno: "",
    gli: "",
    travaux: "",
    loan_amount: "",
    loan_rate: "",
    loan_duration: "",
    loan_monthly: "",
    loan_remaining: "",
  });

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

  // Auto-fetch market price when property is loaded and has an address
  useEffect(() => {
    if (!property?.address || property.address.length < 5) return;
    setMarketLoading(true);
    setMarketData(null);
    fetch(`/api/prix-m2?address=${encodeURIComponent(property.address)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.prixM2) setMarketData(data as MarketData);
      })
      .catch(() => {})
      .finally(() => setMarketLoading(false));
  }, [property?.address]);

  function openEdit() {
    if (!property) return;
    const { taxeFonciere, copro, pno, gli, travaux } = getChargeAmounts(charges);
    setEditForm({
      name: property.name,
      address: property.address ?? "",
      type: property.type,
      surface: property.surface?.toString() ?? "",
      purchase_price: property.purchase_price.toString(),
      current_value: property.current_value.toString(),
      purchase_date: property.purchase_date ?? "",
      regime: property.regime ?? "",
      monthly_rent: revenue?.monthly_rent?.toString() ?? "",
      vacancy_rate: revenue?.vacancy_rate?.toString() ?? "8",
      taxe_fonciere: taxeFonciere.toString(),
      copro: copro.toString(),
      pno: pno.toString(),
      gli: gli.toString(),
      travaux: travaux.toString(),
      loan_amount: loan?.amount?.toString() ?? "",
      loan_rate: loan?.rate?.toString() ?? "",
      loan_duration: loan?.duration_years?.toString() ?? "",
      loan_monthly: loan?.monthly_payment?.toString() ?? "",
      loan_remaining: loan?.remaining_capital?.toString() ?? "",
    });
    setEditOpen(true);
  }

  function handleChange(key: keyof EditForm, value: string) {
    setEditForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    if (!property) return;
    setSaving(true);
    try {
      // Update property
      await supabase
        .from("properties")
        .update({
          name: editForm.name,
          address: editForm.address || null,
          type: editForm.type,
          surface: editForm.surface ? parseFloat(editForm.surface) : null,
          purchase_price: parseFloat(editForm.purchase_price) || 0,
          current_value: parseFloat(editForm.current_value) || 0,
          purchase_date: editForm.purchase_date || null,
          regime: editForm.regime || null,
        })
        .eq("id", id);

      // Update loan if it exists
      if (loan?.id) {
        await supabase
          .from("loans")
          .update({
            amount: parseFloat(editForm.loan_amount) || 0,
            rate: parseFloat(editForm.loan_rate) || 0,
            duration_years: parseFloat(editForm.loan_duration) || 0,
            monthly_payment: parseFloat(editForm.loan_monthly) || 0,
            remaining_capital: parseFloat(editForm.loan_remaining) || 0,
          })
          .eq("id", loan.id);
      }

      // Upsert revenue
      const rentVal = parseFloat(editForm.monthly_rent) || 0;
      const vacancyVal = parseFloat(editForm.vacancy_rate) || 8;
      if (revenue) {
        await supabase
          .from("revenues")
          .update({ monthly_rent: rentVal, vacancy_rate: vacancyVal })
          .eq("property_id", id);
      } else if (rentVal > 0) {
        await supabase
          .from("revenues")
          .insert({ property_id: id, monthly_rent: rentVal, vacancy_rate: vacancyVal });
      }

      // Replace charges: delete all then re-insert non-zero
      await supabase.from("charges").delete().eq("property_id", id);
      const newCharges = [
        { property_id: id, type: "taxe_fonciere", amount: parseFloat(editForm.taxe_fonciere) || 0, frequency: "annual" },
        { property_id: id, type: "copro", amount: parseFloat(editForm.copro) || 0, frequency: "annual" },
        { property_id: id, type: "pno", amount: parseFloat(editForm.pno) || 0, frequency: "annual" },
        { property_id: id, type: "gli", amount: parseFloat(editForm.gli) || 0, frequency: "annual" },
        { property_id: id, type: "travaux", amount: parseFloat(editForm.travaux) || 0, frequency: "annual" },
      ].filter((c) => c.amount > 0);
      if (newCharges.length > 0) {
        await supabase.from("charges").insert(newCharges);
      }

      // Reload data
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
        supabase.from("charges").select("type, amount, frequency").eq("property_id", id),
        supabase.from("revenues").select("monthly_rent, vacancy_rate").eq("property_id", id).maybeSingle(),
      ]);

      if (prop) setProperty(prop);
      setLoan(loanData ?? null);
      setCharges(chargesData ?? []);
      setRevenue(revData ?? null);
      setEditOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    await supabase.from("charges").delete().eq("property_id", id);
    await supabase.from("revenues").delete().eq("property_id", id);
    await supabase.from("loans").delete().eq("property_id", id);
    await supabase.from("properties").delete().eq("id", id);
    router.push("/biens");
  }

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
          <button
            onClick={openEdit}
            className="w-9 h-9 rounded-xl bg-bg border border-border flex items-center justify-center text-text-secondary hover:text-accent transition-colors shrink-0"
            aria-label="Modifier"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => setDeleteOpen(true)}
            className="w-9 h-9 rounded-xl bg-bg border border-[#FF6B6B]/30 flex items-center justify-center text-[#FF6B6B]/70 hover:text-[#FF6B6B] hover:border-[#FF6B6B] transition-colors shrink-0"
            aria-label="Supprimer"
          >
            <Trash2 size={15} />
          </button>
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
        {tab === 0 && (
          <TabOverview
            property={property}
            loan={loan}
            marketData={marketData}
            marketLoading={marketLoading}
          />
        )}
        {tab === 1 && <TabCashflow lines={lines} total={cashflowTotal} />}
        {tab === 2 && <TabScore scores={scores} />}
      </div>

      {/* Edit bottom sheet */}
      <EditSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        form={editForm}
        onChange={handleChange}
        onSave={handleSave}
        saving={saving}
        hasLoan={!!loan}
      />

      {/* Delete confirmation modal */}
      <DeleteModal
        open={deleteOpen}
        propertyName={property.name}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
        deleting={deleting}
      />
    </div>
  );
}
