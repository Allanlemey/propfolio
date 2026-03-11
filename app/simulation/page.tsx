"use client";

import { useState, useEffect, useRef } from "react";
import { useUserTmi } from "@/hooks/use-user-tmi";
import { Loader2, Check, TrendingUp, AlertTriangle, BookOpen, Trash2, ChevronRight, ExternalLink, Plus, Pencil } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  calcMonthlyPayment,
  calcRemainingCapital,
  calcMonthlyTax,
} from "@/lib/calculations";

// ── Helpers ───────────────────────────────────────────────────

function fmt(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(Math.abs(n)));
}

function fmtK(n: number): string {
  if (Math.abs(n) >= 1_000_000)
    return (n / 1_000_000).toFixed(1).replace(".", ",") + " M€";
  if (Math.abs(n) >= 1_000) return Math.round(n / 1_000) + " K€";
  return fmt(n) + " €";
}

// ── Slider ────────────────────────────────────────────────────

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  fv,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  fv: (v: number) => string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-secondary">{label}</span>
        <span className="font-mono font-bold text-sm text-accent">
          {fv(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-accent [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:cursor-pointer"
        style={{
          background: `linear-gradient(to right, var(--accent) ${pct}%, var(--border) ${pct}%)`,
        }}
      />
      <div className="flex justify-between text-[10px] text-text-secondary">
        <span>{fv(min)}</span>
        <span>{fv(max)}</span>
      </div>
    </div>
  );
}

// ── Hypothesis stepper ────────────────────────────────────────

function Stepper({
  label,
  value,
  min,
  max,
  step,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  suffix: string;
}) {
  const dec = () =>
    onChange(Math.max(min, parseFloat((value - step).toFixed(2))));
  const inc = () =>
    onChange(Math.min(max, parseFloat((value + step).toFixed(2))));

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-text-secondary">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={dec}
          className="w-7 h-7 rounded-lg bg-bg border border-border flex items-center justify-center text-text-secondary hover:text-text hover:border-accent/40 transition-colors font-bold text-base leading-none"
        >
          −
        </button>
        <span className="font-mono text-sm font-semibold text-text w-14 text-center">
          {value} {suffix}
        </span>
        <button
          type="button"
          onClick={inc}
          className="w-7 h-7 rounded-lg bg-bg border border-border flex items-center justify-center text-text-secondary hover:text-text hover:border-accent/40 transition-colors font-bold text-base leading-none"
        >
          +
        </button>
      </div>
    </div>
  );
}

// ── Projection chart ──────────────────────────────────────────

function ProjectionChart({ data }: { data: { year: number; net: number }[] }) {
  const W = 560,
    H = 160;
  const PAD = { top: 16, right: 8, bottom: 28, left: 52 };

  const values = data.map((d) => d.net);
  const minVal = Math.min(0, ...values);
  const maxVal = Math.max(...values) * 1.06;
  const range = maxVal - minVal || 1;

  const plotH = H - PAD.top - PAD.bottom;
  const plotW = W - PAD.left - PAD.right;
  const gap = plotW / data.length;
  const barW = gap * 0.58;

  const barY = (v: number) =>
    PAD.top + plotH - Math.max(0, ((v - minVal) / range) * plotH);
  const barH = (v: number) =>
    Math.max(0, ((v - minVal) / range) * plotH);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: 180 }}
      aria-label="Projection patrimoine net 10 ans"
    >
      <defs>
        <linearGradient id="projGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6C63FF" />
          <stop offset="100%" stopColor="#00D9A6" />
        </linearGradient>
      </defs>

      {[0, 0.5, 1].map((t, i) => {
        const val = minVal + range * t;
        const y = PAD.top + plotH * (1 - t);
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
              {Math.abs(val) >= 1000
                ? `${Math.round(val / 1000)}K`
                : Math.round(val)}
            </text>
          </g>
        );
      })}

      {data.map((d, i) => {
        const isLast = i === data.length - 1;
        const x = PAD.left + gap * i + (gap - barW) / 2;
        return (
          <g key={i}>
            <rect
              x={x}
              y={barY(d.net)}
              width={barW}
              height={barH(d.net)}
              rx={3}
              fill={isLast ? "url(#projGrad)" : "var(--accent)"}
              opacity={isLast ? 1 : 0.28}
            />
            <text
              x={x + barW / 2}
              y={H - PAD.bottom + 14}
              textAnchor="middle"
              fontSize={9}
              fill={isLast ? "var(--text)" : "var(--text-secondary)"}
              fontWeight={isLast ? 600 : 400}
            >
              {d.year === 0 ? "Auj." : `A${d.year}`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Types ─────────────────────────────────────────────────────

type SavedSim = {
  id: string;
  name: string;
  params: {
    price: number; apport: number; taux: number; duree: number;
    loyer: number; regime: string; revaluation: number;
    vacance: number; inflationLoyers: number; listingUrl?: string;
  };
  results: {
    cashflow: number; rendementBrut: number; rendementNet: number;
  };
  created_at: string;
};

// ── Saved Simulations List ────────────────────────────────────

function SimList({
  sims, activeId, onLoad, onDelete,
}: {
  sims: SavedSim[]; activeId: string | null;
  onLoad: (s: SavedSim) => void; onDelete: (id: string) => void;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (sims.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-text flex items-center gap-2">
          <BookOpen size={14} className="text-accent" />
          Simulations sauvegardées
          <span className="font-mono text-xs font-normal text-text-secondary bg-bg border border-border rounded-full px-2 py-0.5">
            {sims.length}
          </span>
        </p>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory scrollbar-hide">
        {sims.map(s => {
          const cfPos = s.results.cashflow >= 0;
          const isActive = activeId === s.id;
          const date = new Date(s.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

          return (
            <div
              key={s.id}
              className={`snap-start shrink-0 w-52 rounded-2xl border p-3.5 transition-all ${
                isActive
                  ? "border-accent/60 bg-accent/5 shadow-[0_0_0_1px_rgba(108,99,255,0.2)]"
                  : "border-border bg-card hover:border-accent/30"
              }`}
            >
              {/* Name + date */}
              <div className="flex items-start justify-between gap-1 mb-2">
                <p className="text-xs font-semibold text-text leading-tight line-clamp-2">{s.name}</p>
                <span className="text-[10px] text-text-secondary shrink-0">{date}</span>
              </div>

              {/* Results */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className={`font-mono text-base font-bold leading-tight ${cfPos ? "text-green" : "text-red"}`}>
                    {cfPos ? "+" : "−"}{fmt(s.results.cashflow)} €
                  </p>
                  <p className="text-[10px] text-text-secondary">cashflow/mois</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-bold text-[#FBBF24]">
                    {s.results.rendementNet.toFixed(1)} %
                  </p>
                  <p className="text-[10px] text-text-secondary">rendement net</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => onLoad(s)}
                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors ${
                    isActive
                      ? "bg-accent text-white"
                      : "bg-bg border border-border text-text-secondary hover:text-text hover:border-accent/40"
                  }`}
                >
                  <ChevronRight size={11} />
                  {isActive ? "Chargée" : "Charger"}
                </button>
                {s.params.listingUrl && (
                  <a
                    href={s.params.listingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-7 h-7 rounded-lg bg-bg border border-border flex items-center justify-center text-text-secondary hover:text-accent hover:border-accent/30 transition-colors"
                    title="Voir l'annonce"
                  >
                    <ExternalLink size={11} />
                  </a>
                )}
                <button
                  onClick={async () => {
                    setDeletingId(s.id);
                    await onDelete(s.id);
                    setDeletingId(null);
                  }}
                  disabled={deletingId === s.id}
                  className="w-7 h-7 rounded-lg bg-bg border border-border flex items-center justify-center text-text-secondary hover:text-red hover:border-red/30 transition-colors disabled:opacity-40"
                >
                  {deletingId === s.id
                    ? <Loader2 size={11} className="animate-spin" />
                    : <Trash2 size={11} />}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────

const REGIMES = ["LMNP micro-BIC", "LMNP réel", "Nu micro-foncier", "Nu réel"];

export default function SimulationPage() {
  const tmi = useUserTmi();

  // Inputs
  const [price, setPrice] = useState(120000);
  const [apport, setApport] = useState(10000);
  const [taux, setTaux] = useState(3.8);
  const [duree, setDuree] = useState(20);
  const [loyer, setLoyer] = useState(650);
  const [regime, setRegime] = useState("LMNP micro-BIC");

  // Hypotheses
  const [revaluation, setRevaluation] = useState(2);
  const [vacance, setVacance] = useState(4);
  const [inflationLoyers, setInflationLoyers] = useState(1.8);

  // Listing URL
  const [listingUrl, setListingUrl] = useState("");

  // Simulation name
  const [simName, setSimName] = useState("");

  // Saved simulations
  const [savedSims, setSavedSims] = useState<SavedSim[]>([]);
  const [activeSimId, setActiveSimId] = useState<string | null>(null);
  const simulatorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadSims() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("simulations")
        .select("id, name, params, results, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (data) setSavedSims(data as SavedSim[]);
    }
    loadSims();
  }, []);

  function loadSim(s: SavedSim) {
    setPrice(s.params.price);
    setApport(s.params.apport);
    setTaux(s.params.taux);
    setDuree(s.params.duree);
    setLoyer(s.params.loyer);
    setRegime(s.params.regime);
    setRevaluation(s.params.revaluation ?? 2);
    setVacance(s.params.vacance ?? 4);
    setInflationLoyers(s.params.inflationLoyers ?? 1.8);
    setListingUrl(s.params.listingUrl ?? "");
    setSimName(s.name);
    setActiveSimId(s.id);
    simulatorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function deleteSim(id: string) {
    await supabase.from("simulations").delete().eq("id", id);
    setSavedSims(prev => prev.filter(s => s.id !== id));
    if (activeSimId === id) setActiveSimId(null);
  }

  // Save
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // ── Derived calculations ─────────────────────────────────────

  const effectiveApport = Math.min(apport, price);
  const principal = Math.max(0, price - effectiveApport);
  const mp = calcMonthlyPayment(principal, taux, duree);

  const annualRent = loyer * 12;
  const annualTaxeFonciere = price * 0.008;
  const annualCopro = 600;
  const annualPno = 150;
  const annualGli = annualRent * 0.025;
  const annualTravaux = 300;
  const annualCharges =
    annualTaxeFonciere + annualCopro + annualPno + annualGli + annualTravaux;
  const annualInterest = principal * (taux / 100);
  const amortissement = price * 0.025;

  const monthlyTax = calcMonthlyTax(
    regime,
    annualRent,
    annualCharges,
    annualInterest,
    amortissement,
    tmi
  );

  const provisionVacance = loyer * (vacance / 100);
  const cashflow =
    loyer - mp - annualCharges / 12 - provisionVacance - monthlyTax;

  const rendementBrut = price > 0 ? (annualRent / price) * 100 : 0;
  const rendementNet = price > 0 ? ((annualRent - annualCharges) / price) * 100 : 0;

  const projection = Array.from({ length: 11 }, (_, y) => ({
    year: y,
    net:
      price * Math.pow(1 + revaluation / 100, y) -
      calcRemainingCapital(principal, taux, duree, y),
  }));

  const cfPositive = cashflow >= 0;

  function resetForm() {
    setPrice(120000); setApport(10000); setTaux(3.8); setDuree(20);
    setLoyer(650); setRegime("LMNP micro-BIC"); setRevaluation(2);
    setVacance(4); setInflationLoyers(1.8); setListingUrl(""); setSimName("");
    setActiveSimId(null);
    simulatorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ── Save ─────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const resolvedName = simName.trim() || `Simulation ${fmtK(price)} — ${loyer} €/mois`;

    const payload = {
      name: resolvedName,
      params: {
        price,
        apport: effectiveApport,
        taux,
        duree,
        loyer,
        regime,
        revaluation,
        vacance,
        inflationLoyers,
        listingUrl: listingUrl.trim() || undefined,
      },
      results: {
        cashflow: Math.round(cashflow),
        rendementBrut: parseFloat(rendementBrut.toFixed(2)),
        rendementNet: parseFloat(rendementNet.toFixed(2)),
        monthlyPayment: Math.round(mp),
        monthlyTax: Math.round(monthlyTax),
        patrimoineAujourdhui: Math.round(projection[0].net),
        patrimoine10ans: Math.round(projection[10].net),
      },
    };

    if (activeSimId) {
      await supabase.from("simulations").update(payload).eq("id", activeSimId);
    } else {
      const { data: inserted } = await supabase.from("simulations").insert({ user_id: user.id, ...payload }).select("id").single();
      if (inserted) setActiveSimId(inserted.id);
    }

    // Refresh saved list
    const { data: { user: u } } = await supabase.auth.getUser();
    if (u) {
      const { data } = await supabase
        .from("simulations")
        .select("id, name, params, results, created_at")
        .eq("user_id", u.id)
        .order("created_at", { ascending: false });
      if (data) setSavedSims(data as SavedSim[]);
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className="px-4 pt-5 pb-8 max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-text leading-tight">
          Simuler une acquisition
        </h1>
        <p className="text-text-secondary text-sm mt-0.5">
          Testez un investissement avant d&apos;acheter
        </p>
      </div>

      {/* Saved simulations */}
      <SimList
        sims={savedSims}
        activeId={activeSimId}
        onLoad={loadSim}
        onDelete={deleteSim}
      />

      {/* Inputs */}
      <div ref={simulatorRef} className="bg-card rounded-2xl p-4 border border-border space-y-5">
        <Slider
          label="Prix du bien"
          value={price}
          min={50000}
          max={500000}
          step={5000}
          onChange={setPrice}
          fv={(v) => `${fmt(v)} €`}
        />
        <Slider
          label="Apport personnel"
          value={effectiveApport}
          min={0}
          max={Math.min(200000, price)}
          step={1000}
          onChange={setApport}
          fv={(v) => `${fmt(v)} €`}
        />
        <Slider
          label="Taux de crédit"
          value={taux}
          min={1}
          max={6}
          step={0.1}
          onChange={setTaux}
          fv={(v) => `${v.toFixed(1)} %`}
        />
        <Slider
          label="Durée du crédit"
          value={duree}
          min={10}
          max={25}
          step={1}
          onChange={setDuree}
          fv={(v) => `${v} ans`}
        />
        <Slider
          label="Loyer mensuel estimé"
          value={loyer}
          min={200}
          max={3000}
          step={10}
          onChange={setLoyer}
          fv={(v) => `${v} €/mois`}
        />

        {/* URL annonce */}
        <div className="space-y-2">
          <label className="text-sm text-text-secondary" htmlFor="listing-url">
            URL de l&apos;annonce <span className="text-text-muted text-xs">(optionnel)</span>
          </label>
          <div className="relative">
            <ExternalLink size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
            <input
              id="listing-url"
              type="url"
              value={listingUrl}
              onChange={(e) => setListingUrl(e.target.value)}
              placeholder="https://www.leboncoin.fr/..."
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-bg border border-border text-sm text-text placeholder:text-text-secondary/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors"
            />
          </div>
        </div>

        {/* Régime fiscal */}
        <div className="space-y-2">
          <p className="text-sm text-text-secondary">Régime fiscal</p>
          <div className="flex flex-wrap gap-2">
            {REGIMES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRegime(r)}
                className={`text-[11px] px-2.5 py-1.5 rounded-lg border transition-colors font-medium ${
                  regime === r
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-border text-text-secondary hover:border-accent/40 hover:text-text"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Hero cashflow */}
      <div
        className={`rounded-2xl p-6 border ${
          cfPositive
            ? "bg-green/5 border-green/20"
            : "bg-red/5 border-red/20"
        }`}
      >
        <p
          className={`text-xs font-semibold uppercase tracking-widest mb-2 ${
            cfPositive ? "text-green" : "text-red"
          }`}
        >
          Cashflow net mensuel estimé
        </p>
        <p
          className={`font-mono font-bold leading-tight mb-2 ${
            cfPositive ? "text-green" : "text-red"
          }`}
          style={{ fontSize: 42 }}
        >
          {cfPositive ? "+" : "−"}
          {fmt(cashflow)} €
        </p>
        <p
          className={`text-sm ${
            cfPositive ? "text-green/80" : "text-red/80"
          }`}
        >
          {cfPositive
            ? "Cashflow positif — ce projet s'autofinance"
            : "Cashflow négatif — effort d'épargne nécessaire"}
        </p>
      </div>

      {/* 4 KPI cards */}
      <div className="grid grid-cols-2 gap-3">
        {[
          {
            label: "Rendement brut",
            value: `${rendementBrut.toFixed(2)} %`,
            sub: "loyer annuel / prix",
          },
          {
            label: "Rendement net",
            value: `${rendementNet.toFixed(2)} %`,
            sub: "après charges fixes",
          },
          {
            label: "Mensualité crédit",
            value: mp > 0 ? `${fmt(mp)} €` : "Comptant",
            sub: "capital + intérêts",
          },
          {
            label: "Impôt mensuel",
            value: `${fmt(monthlyTax)} €`,
            sub: regime.replace("LMNP ", "").replace("Nu ", "Nu "),
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="bg-card rounded-2xl p-4 border border-border"
          >
            <p className="text-xs text-text-secondary uppercase tracking-wide mb-1 leading-tight">
              {kpi.label}
            </p>
            <p className="font-mono font-bold text-xl text-text">
              {kpi.value}
            </p>
            <p className="text-[10px] text-text-secondary mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Projection chart */}
      <div className="bg-card rounded-2xl p-4 border border-border">
        <p className="text-sm font-semibold text-text mb-0.5">
          Projection patrimoine net — 10 ans
        </p>
        <p className="text-[11px] text-text-secondary mb-3">
          Valeur bien revalorisée − capital restant dû
        </p>
        <ProjectionChart data={projection} />
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="bg-bg rounded-xl p-3 border border-border text-center">
            <p className="text-[10px] text-text-secondary mb-1">
              Aujourd&apos;hui
            </p>
            <p className="font-mono font-bold text-base text-text">
              {fmtK(projection[0].net)}
            </p>
          </div>
          <div className="bg-bg rounded-xl p-3 border border-border text-center">
            <p className="text-[10px] text-text-secondary mb-1">Dans 10 ans</p>
            <p className="font-mono font-bold text-base text-accent">
              {fmtK(projection[10].net)}
            </p>
          </div>
        </div>
      </div>

      {/* Hypotheses */}
      <div className="bg-card rounded-2xl p-4 border border-border">
        <p className="text-sm font-semibold text-text mb-4">Hypothèses</p>
        <div className="space-y-4">
          <Stepper
            label="Revalorisation annuelle"
            value={revaluation}
            min={0}
            max={5}
            step={0.5}
            onChange={setRevaluation}
            suffix="%"
          />
          <Stepper
            label="Vacance locative"
            value={vacance}
            min={0}
            max={15}
            step={1}
            onChange={setVacance}
            suffix="%"
          />
          <Stepper
            label="Inflation loyers"
            value={inflationLoyers}
            min={0}
            max={4}
            step={0.2}
            onChange={setInflationLoyers}
            suffix="%"
          />
        </div>
      </div>

      {/* Disclaimer */}
      <div className="flex gap-3 p-4 bg-[#FBBF24]/5 border border-[#FBBF24]/20 rounded-xl">
        <AlertTriangle
          size={16}
          className="text-[#FBBF24] shrink-0 mt-0.5"
        />
        <p className="text-xs text-text-secondary leading-relaxed">
          Les calculs fiscaux sont indicatifs (TMI {Math.round(tmi * 100)} % — modifiable dans votre profil). Consultez
          un expert-comptable pour votre situation personnelle.
        </p>
      </div>

      {/* Save */}
      <div className="space-y-3">
        {/* Nom de la simulation */}
        <div className="relative">
          <Pencil size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
          <input
            type="text"
            value={simName}
            onChange={(e) => setSimName(e.target.value)}
            placeholder={`Simulation ${fmtK(price)} — ${loyer} €/mois`}
            className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-card border border-border text-sm text-text placeholder:text-text-secondary/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors"
          />
        </div>

        <div className="flex gap-2">
          {activeSimId && (
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-3.5 rounded-xl text-sm font-semibold border border-border text-text-secondary hover:text-text hover:border-accent/40 flex items-center gap-2 transition-colors"
            >
              <Plus size={14} />
              Nouvelle
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || saved}
            className="flex-1 py-3.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-70 active:scale-[0.98] transition-all"
            style={{
              background: saved
                ? "var(--green)"
                : "linear-gradient(135deg, #6C63FF 0%, #00D9A6 100%)",
            }}
          >
            {saving ? (
              <Loader2 size={15} className="animate-spin" />
            ) : saved ? (
              <Check size={15} />
            ) : activeSimId ? (
              <Pencil size={15} />
            ) : (
              <TrendingUp size={15} />
            )}
            {saved
              ? "Mise à jour sauvegardée !"
              : activeSimId
              ? "Mettre à jour la simulation"
              : "Sauvegarder cette simulation"}
          </button>
        </div>
      </div>
    </div>
  );
}
