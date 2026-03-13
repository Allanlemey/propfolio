"use client";

import { useState, useEffect, useRef } from "react";
import { useUserTmi } from "@/hooks/use-user-tmi";
import { Loader2, Check, TrendingUp, AlertTriangle, BookOpen, Trash2, ChevronRight, ExternalLink, Plus, Pencil, Download, Printer } from "lucide-react";
import { supabase } from "@/lib/supabase";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
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
        <span className="text-sm font-medium text-text-secondary">{label}</span>
        <span className="font-mono font-black text-sm text-accent">
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
      <span className="text-sm font-medium text-text-secondary">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={dec}
          className="w-7 h-7 rounded-xl bg-bg border border-border/60 flex items-center justify-center text-text-secondary hover:text-text hover:border-accent/40 transition-colors font-black text-base leading-none shadow-sm"
        >
          −
        </button>
        <span className="font-mono text-sm font-black text-text w-14 text-center">
          {value} {suffix}
        </span>
        <button
          type="button"
          onClick={inc}
          className="w-7 h-7 rounded-xl bg-bg border border-border/60 flex items-center justify-center text-text-secondary hover:text-text hover:border-accent/40 transition-colors font-black text-base leading-none shadow-sm"
        >
          +
        </button>
      </div>
    </div>
  );
}

// ── Projection chart ──────────────────────────────────────────

function ProjectionChart({
  data,
  onSelectYear,
}: {
  data: { year: number; net: number }[];
  onSelectYear?: (year: number, net: number) => void;
}) {
  const W = 560,
    H = 160;
  const PAD = { top: 16, right: 8, bottom: 28, left: 52 };

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; year: number; net: number } | null>(null);

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

  const handleBarClick = (i: number, d: { year: number; net: number }, event: React.MouseEvent) => {
    setSelectedIndex(i);
    onSelectYear?.(d.year, d.net);
    const rect = (event.target as Element).closest('svg')?.getBoundingClientRect();
    if (rect) {
      const barX = PAD.left + gap * i + (gap - barW) / 2 + barW / 2;
      setTooltip({
        x: (barX / W) * rect.width,
        y: barY(d.net) / H * rect.height - 8,
        year: d.year,
        net: d.net,
      });
    }
  };

  const handleCloseTooltip = () => {
    setTooltip(null);
    setSelectedIndex(null);
  };

  // Réinitialiser la sélection quand les données changent
  useEffect(() => {
    setSelectedIndex(null);
    setTooltip(null);
  }, [data]);

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full cursor-pointer"
        style={{ height: 180 }}
        aria-label="Projection patrimoine net 10 ans"
        onClick={handleCloseTooltip}
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
          const isSelected = selectedIndex === i;
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
                opacity={isLast ? 1 : isSelected ? 0.6 : 0.28}
                className="transition-all duration-200 hover:opacity-80"
                style={{
                  filter: isSelected ? 'drop-shadow(0 0 4px rgba(108,99,255,0.5))' : undefined,
                  cursor: 'pointer',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleBarClick(i, d, e);
                }}
              />
              <text
                x={x + barW / 2}
                y={H - PAD.bottom + 14}
                textAnchor="middle"
                fontSize={9}
                fill={isLast || isSelected ? "var(--text)" : "var(--text-secondary)"}
                fontWeight={isLast || isSelected ? 600 : 400}
              >
                {d.year === 0 ? "Auj." : `A${d.year}`}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-10"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="bg-surface border border-border rounded-lg px-3 py-2 shadow-lg">
            <p className="text-xs text-text-secondary mb-0.5">
              {tooltip.year === 0 ? "Aujourd'hui" : `Année ${tooltip.year}`}
            </p>
            <p className="font-mono font-bold text-sm text-accent">
              {fmtK(tooltip.net)}
            </p>
          </div>
          <div className="w-2 h-2 bg-surface border-r border-b border-border rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1" />
        </div>
      )}

      {/* Instruction hint */}
      {!tooltip && (
        <p className="text-center text-[10px] text-text-secondary mt-1">
          Cliquez sur une barre pour voir le détail
        </p>
      )}
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────

type SavedSim = {
  id: string;
  name: string;
  params: {
    price: number; apport: number; taux: number; duree: number;
    loyer: number; regime: string; revaluation: number;
    vacance: number; inflationLoyers: number; listingUrl?: string; dpe?: string;
    notaire?: number; travaux?: number;
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
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <p className="text-sm font-black text-text flex items-center gap-2">
          <BookOpen size={14} className="text-accent" />
          Simulations sauvegardées
          <span className="font-mono text-xs font-bold text-text-secondary bg-bg border border-border rounded-full px-2 py-0.5">
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
              className={`snap-start shrink-0 w-52 rounded-[22px] border overflow-hidden relative p-3.5 transition-all shadow-sm ${
                isActive
                  ? "border-accent/60 bg-accent/5 shadow-[0_0_0_1px_rgba(108,99,255,0.2)]"
                  : "border-border/60 bg-card hover:border-accent/30"
              }`}
            >
              <div className={`absolute top-0 left-0 right-0 h-[3px] ${cfPos ? "bg-green" : "bg-red"} opacity-70`} />
              {/* Name + date */}
              <div className="flex items-start justify-between gap-1 mb-2 mt-1">
                <p className="text-xs font-black text-text leading-tight line-clamp-2">{s.name}</p>
                <span className="text-[10px] text-text-muted font-bold shrink-0">{date}</span>
              </div>

              {/* Results */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className={`font-mono text-base font-black leading-tight ${cfPos ? "text-green" : "text-red"}`}>
                    {cfPos ? "+" : "−"}{fmt(s.results.cashflow)} €
                  </p>
                  <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider">cashflow/mois</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-black text-[#FBBF24]">
                    {s.results.rendementNet.toFixed(1)} %
                  </p>
                  <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider">rendement net</p>
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
  const [notaire, setNotaire] = useState(120000 * 0.08);
  const [regime, setRegime] = useState("LMNP micro-BIC");
  const [travaux, setTravaux] = useState(0);

  // PDF Preview State
  const [showPreview, setShowPreview] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [pdfZoom, setPdfZoom] = useState(1);
  const reportRef = useRef<HTMLDivElement>(null);

  // Hypotheses
  const [revaluation, setRevaluation] = useState(2);
  const [vacance, setVacance] = useState(4);
  const [inflationLoyers, setInflationLoyers] = useState(1.8);

  // Listing URL & DPE
  const [listingUrl, setListingUrl] = useState("");
  const [dpe, setDpe] = useState("");

  // Auto-calc notaire on price change
  useEffect(() => {
    setNotaire(Math.round(price * 0.08));
  }, [price]);

  // Simulation name
  const [simName, setSimName] = useState("");

  // Saved simulations
  const [savedSims, setSavedSims] = useState<SavedSim[]>([]);
  const [activeSimId, setActiveSimId] = useState<string | null>(null);
  const simulatorRef = useRef<HTMLDivElement>(null);

  // Selected projection year for chart interaction
  const [selectedProjectionIndex, setSelectedProjectionIndex] = useState<number>(0);

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

  useEffect(() => {
    if (!showPreview) return;
    const compute = () => {
      const w = window.innerWidth - 32;
      setPdfZoom(w < 794 ? w / 794 : 1);
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [showPreview]);

  function loadSim(s: SavedSim) {
    setPrice(s.params.price);
    setApport(s.params.apport);
    setTaux(s.params.taux);
    setDuree(s.params.duree);
    setLoyer(s.params.loyer);
    setNotaire(s.params.notaire ?? Math.round(s.params.price * 0.08));
    setRegime(s.params.regime);
    setRevaluation(s.params.revaluation ?? 2);
    setVacance(s.params.vacance ?? 4);
    setInflationLoyers(s.params.inflationLoyers ?? 1.8);
    setListingUrl(s.params.listingUrl ?? "");
    setDpe(s.params.dpe ?? "");
    setTravaux(s.params.travaux ?? 0);
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

  const totalAcquisition = price + notaire + travaux;
  const effectiveApport = Math.min(apport, totalAcquisition);
  const principal = Math.max(0, totalAcquisition - effectiveApport);
  const mp = calcMonthlyPayment(principal, taux, duree);

  const annualRent = loyer * 12;
  const annualTaxeFonciere = price * 0.008;
  const annualCopro = 600;
  const annualPno = 150;
  const annualGli = annualRent * 0.025;
  const annualTravauxProvision = 300;
  const annualCharges =
    annualTaxeFonciere + annualCopro + annualPno + annualGli + annualTravauxProvision;
  const annualInterest = principal * (taux / 100);
  
  // Amortissement calculation: 80% of property over 20 years (4%) + 10% of works
  const amortissement = (price * 0.04) + (travaux * 0.1);

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
    setLoyer(650); setNotaire(120000 * 0.08); setRegime("LMNP micro-BIC"); setRevaluation(2);
    setVacance(4); setInflationLoyers(1.8); setListingUrl(""); setDpe(""); setSimName(""); setTravaux(0);
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
        dpe: dpe || undefined,
        notaire,
        travaux,
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

  async function handleActualDownload() {
    if (!reportRef.current) return;
    setIsDownloading(true);
    try {
      const element = reportRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      
      const safeName = (simName || "simulation")
        .replace(/[^a-z0-9]/gi, "_")
        .toLowerCase();
      
      pdf.save(`${safeName}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
    } finally {
      setIsDownloading(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────

  return (
    <>
      <div className="relative min-h-screen bg-bg no-print overflow-x-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 inset-x-0 h-[400px] bg-gradient-to-b from-accent/5 to-transparent pointer-events-none" />
      <div className="absolute top-20 right-[-10%] w-[40%] h-[20%] bg-accent/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative px-4 pt-8 pb-12 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between px-1">
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-text tracking-tight leading-none bg-gradient-to-r from-text to-text-secondary bg-clip-text text-transparent">
            Simuler une acquisition
          </h1>
          <div className="text-text-muted text-xs font-bold uppercase tracking-widest flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            Simulation temps réel
          </div>
        </div>
      </div>

      {/* Saved simulations */}
      <SimList
        sims={savedSims}
        activeId={activeSimId}
        onLoad={loadSim}
        onDelete={deleteSim}
      />

      {/* Inputs */}
      <div ref={simulatorRef} className="bg-card rounded-[26px] border border-border/60 overflow-hidden shadow-sm relative">
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-accent opacity-80" />
        <div className="p-5 space-y-5">
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
        <Slider
          label="Frais de notaire"
          value={notaire}
          min={0}
          max={50000}
          step={100}
          onChange={setNotaire}
          fv={(v) => `${fmt(v)} €`}
        />
        <Slider
          label="Estimation travaux"
          value={travaux}
          min={0}
          max={200000}
          step={1000}
          onChange={setTravaux}
          fv={(v) => `${fmt(v)} €`}
        />

        {/* URL annonce */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-text-secondary" htmlFor="listing-url">
            URL de l&apos;annonce <span className="text-text-muted text-xs font-bold">(optionnel)</span>
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

        {/* DPE */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-text-secondary">Classe énergie (DPE)</p>
          <div className="flex gap-1.5">
            {(["A", "B", "C", "D", "E", "F", "G"] as const).map(letter => {
              const selected = dpe === letter;
              const DPE_COLORS: Record<string, string> = { A: "#319834", B: "#33CC33", C: "#CBFC01", D: "#FFFF00", E: "#FFCC00", F: "#FF6600", G: "#FF0000" };
              const color = DPE_COLORS[letter];
              return (
                <button
                  key={letter}
                  type="button"
                  onClick={() => setDpe(dpe === letter ? "" : letter)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all border"
                  style={{
                    background: selected ? color : "transparent",
                    borderColor: selected ? color : "var(--border)",
                    color: selected ? "#000" : "var(--text-secondary)",
                    opacity: selected ? 1 : 0.6,
                    boxShadow: selected ? `0 2px 8px ${color}55` : "none",
                  }}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        </div>

        {/* Régime fiscal */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-text-secondary">Régime fiscal</p>
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
      </div>

      {/* Hero cashflow */}
      <div
        className={`rounded-[26px] p-6 border overflow-hidden relative shadow-sm ${
          cfPositive
            ? "bg-green/5 border-green/20"
            : "bg-red/5 border-red/20"
        }`}
      >
        <div className={`absolute top-0 left-0 right-0 h-[3px] ${cfPositive ? "bg-green" : "bg-red"} opacity-80`} />
        <p
          className={`text-xs font-black uppercase tracking-widest mb-2 ${
            cfPositive ? "text-green" : "text-red"
          }`}
        >
          Cashflow net mensuel estimé
        </p>
        <p
          className={`font-mono font-black leading-tight mb-2 ${
            cfPositive ? "text-green" : "text-red"
          }`}
          style={{ fontSize: 48 }}
        >
          {cfPositive ? "+" : "−"}
          {fmt(cashflow)} €
        </p>
        <p
          className={`text-sm font-medium ${
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
            className="bg-card rounded-[22px] p-4 border border-border/60 shadow-sm relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-accent opacity-40" />
            <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-2 leading-tight">
              {kpi.label}
            </p>
            <p className="font-mono font-black text-xl text-text">
              {kpi.value}
            </p>
            <p className="text-[10px] text-text-secondary mt-0.5 font-medium">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Projection chart */}
      <div className="bg-card rounded-[26px] border border-border/60 overflow-hidden shadow-sm relative">
        <div className="absolute top-0 left-0 right-0 h-[3px] opacity-80" style={{ background: "linear-gradient(135deg, #6C63FF 0%, #00D9A6 100%)" }} />
        <div className="p-5">
        <p className="text-sm font-black text-text mb-0.5">
          Projection patrimoine net — 10 ans
        </p>
        <p className="text-[11px] text-text-secondary mb-3 font-medium">
          Valeur bien revalorisée − capital restant dû
        </p>
        <ProjectionChart
          data={projection}
          onSelectYear={(year) => {
            const idx = projection.findIndex((p) => p.year === year);
            if (idx !== -1) setSelectedProjectionIndex(idx);
          }}
        />
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="bg-bg rounded-2xl p-3 border border-border/40 text-center">
            <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1">
              {selectedProjectionIndex === 0 ? "Aujourd'hui" : `Année ${projection[selectedProjectionIndex]?.year ?? 0}`}
            </p>
            <p className="font-mono font-black text-base text-text">
              {fmtK(projection[selectedProjectionIndex]?.net ?? projection[0].net)}
            </p>
          </div>
          <div className="bg-bg rounded-2xl p-3 border border-border/40 text-center">
            <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1">
              Dans 10 ans
            </p>
            <p className="font-mono font-black text-base text-accent">
              {fmtK(projection[10]?.net ?? 0)}
            </p>
          </div>
        </div>
        </div>
      </div>

      {/* Hypotheses */}
      <div className="bg-card rounded-[26px] border border-border/60 overflow-hidden shadow-sm relative">
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#FBBF24] opacity-60" />
        <div className="p-5">
        <p className="text-sm font-black text-text mb-4">Hypothèses</p>
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
      </div>

      {/* Disclaimer */}
      <div className="flex gap-3 p-4 bg-[#FBBF24]/5 border border-[#FBBF24]/20 rounded-2xl">
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
            className="w-full pl-8 pr-3 py-3 rounded-2xl bg-card border border-border/60 text-sm font-medium text-text placeholder:text-text-secondary/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors shadow-sm"
          />
        </div>

        <div className="flex gap-2">
          {activeSimId && (
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-3.5 rounded-2xl text-sm font-black border border-border/60 text-text-secondary hover:text-text hover:border-accent/40 flex items-center gap-2 transition-colors shadow-sm"
            >
              <Plus size={14} />
              Nouvelle
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || saved}
            className="flex-1 py-3.5 rounded-2xl text-sm font-black text-white flex items-center justify-center gap-2 disabled:opacity-70 active:scale-[0.98] transition-all shadow-lg shadow-accent/25"
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

        <button
          type="button"
          onClick={() => setShowPreview(true)}
          className="w-full py-3.5 rounded-2xl text-sm font-black text-accent border border-accent/20 bg-accent/5 flex items-center justify-center gap-2 hover:bg-accent/10 transition-all active:scale-[0.99] no-print"
        >
          <TrendingUp size={15} />
          Télécharger le rapport de simulation (PDF)
        </button>
      </div>
      </div>
    </div>

    {/* Modal d'aperçu */}
      {showPreview && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black/60 backdrop-blur-sm print:relative print:z-0 print:bg-white print:backdrop-blur-none print:h-auto print:block">
          {/* Header */}
          <div className="flex items-center justify-between p-3 md:p-4 bg-surface border-b border-border shadow-md no-print">
            <h3 className="font-bold text-base md:text-lg">Rapport PDF</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setShowPreview(false)}
                className="px-3 py-2 rounded-lg text-sm font-semibold border border-border text-text-secondary hover:text-text"
              >
                ✕
              </button>
              <button
                onClick={handleActualDownload}
                disabled={isDownloading}
                className="px-3 py-2 rounded-lg text-sm font-semibold bg-accent text-white flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                {isDownloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                <span className="hidden sm:inline">Télécharger</span>
              </button>
              <button
                onClick={() => window.print()}
                className="hidden md:flex px-3 py-2 rounded-lg text-sm font-semibold border border-border text-text items-center gap-1.5"
              >
                <Printer size={14} />
                <span>Imprimer</span>
              </button>
            </div>
          </div>

          {/* Mobile summary — visible on phones only */}
          <div className="flex-1 overflow-auto md:hidden p-5 bg-bg space-y-4 no-print">
            <div className="text-center space-y-1 pb-4 border-b border-border">
              <p className="text-xs text-text-secondary uppercase tracking-widest font-bold">Analyse financière</p>
              <p className="font-black text-lg text-text">{simName || `Simulation ${fmtK(price)}`}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Cashflow mensuel", value: `${cashflow >= 0 ? "+" : "−"}${fmt(Math.abs(cashflow))} €`, color: cashflow >= 0 ? "text-green" : "text-red" },
                { label: "Rendement net", value: `${rendementNet.toFixed(2)} %`, color: "text-accent" },
                { label: "Mensualité", value: `${fmt(mp)} €/m`, color: "text-text" },
                { label: "Impôt mensuel", value: monthlyTax > 0 ? `${fmt(monthlyTax)} €/m` : "Défiscalisé", color: monthlyTax > 0 ? "text-red" : "text-green" },
              ].map((s, i) => (
                <div key={i} className="bg-card rounded-2xl p-4 border border-border">
                  <p className="text-[11px] text-text-secondary font-medium mb-1">{s.label}</p>
                  <p className={`font-black text-xl font-mono ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>
            <div className="bg-card rounded-2xl p-4 border border-border space-y-2.5">
              <p className="text-xs font-bold text-text-secondary uppercase tracking-wider">Acquisition</p>
              {[
                ["Prix d'achat", `${fmt(price)} €`],
                ["Frais notaire", `${fmt(notaire)} €`],
                ["Travaux", `${fmt(travaux)} €`],
                ["Apport", `${fmt(effectiveApport)} €`],
                ["Emprunt", `${fmt(price + notaire + travaux - effectiveApport)} €`],
              ].map(([l, v], i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-text-secondary">{l}</span>
                  <span className="font-semibold font-mono">{v}</span>
                </div>
              ))}
            </div>
            <div className="bg-card rounded-2xl p-4 border border-border space-y-2.5">
              <p className="text-xs font-bold text-text-secondary uppercase tracking-wider">Crédit</p>
              {[
                ["Taux", `${taux} %`],
                ["Durée", `${duree} ans`],
                ["Régime fiscal", regime],
              ].map(([l, v], i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-text-secondary">{l}</span>
                  <span className="font-semibold">{v}</span>
                </div>
              ))}
            </div>
            {/* Projection 20 ans */}
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-xs font-bold text-text-secondary uppercase tracking-wider">Analyse prospective 20 ans</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 text-left text-[11px] font-bold text-text-secondary">An</th>
                      <th className="px-3 py-2 text-right text-[11px] font-bold text-text-secondary">Loyers</th>
                      <th className="px-3 py-2 text-right text-[11px] font-bold text-text-secondary">Résultat fiscal</th>
                      <th className="px-3 py-2 text-right text-[11px] font-bold text-text-secondary">Impôt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const principal = price + notaire + travaux - effectiveApport;
                      const annualAmortBien = price * 0.04;
                      const annualAmortTravaux = travaux * 0.1;
                      const annualCharges = (price * 0.008) + 600 + 150 + (loyer * 12 * 0.025) + 300;
                      let deficit = 0;
                      return [1, 5, 10, 15, 20].map(y => {
                        const lYear = (loyer * 12) * Math.pow(1 + (inflationLoyers || 1.8) / 100, y - 1);
                        const cYear = annualCharges * Math.pow(1.015, y - 1);
                        const capStart = calcRemainingCapital(principal, taux, duree, y - 1);
                        const intYear = capStart * (taux / 100);
                        const amort = (y <= 20 ? annualAmortBien : 0) + (y <= 10 ? annualAmortTravaux : 0);
                        const rawResult = lYear - (cYear + intYear + amort);
                        let taxBase = 0;
                        if (rawResult > 0) {
                          const used = Math.min(rawResult, deficit);
                          taxBase = rawResult - used;
                          deficit -= used;
                        } else {
                          deficit += Math.abs(rawResult);
                        }
                        const yearlyTax = regime.toLowerCase().includes("réel")
                          ? taxBase * (tmi + 0.172)
                          : (lYear * (regime.toLowerCase().includes("micro-bic") ? 0.5 : 0.7)) * (tmi + 0.172);
                        const isDeficit = rawResult < 0;
                        return (
                          <tr key={y} className="border-b border-border/50 last:border-0">
                            <td className="px-3 py-2.5 font-black text-accent text-sm">A{y}</td>
                            <td className="px-3 py-2.5 text-right font-mono text-xs">{fmt(lYear)} €</td>
                            <td className={`px-3 py-2.5 text-right font-mono text-xs font-bold ${isDeficit ? "text-green" : "text-red"}`}>
                              {isDeficit ? `−${fmt(Math.abs(rawResult))}` : `+${fmt(rawResult)}`} €
                            </td>
                            <td className={`px-3 py-2.5 text-right font-mono text-xs font-bold ${yearlyTax > 0 ? "text-red" : "text-green"}`}>
                              {yearlyTax > 0 ? `${fmt(yearlyTax)} €` : "0 €"}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            <button
              onClick={handleActualDownload}
              disabled={isDownloading}
              className="w-full py-4 rounded-2xl bg-accent text-white font-black flex items-center justify-center gap-2 shadow-lg shadow-accent/20 disabled:opacity-50"
            >
              {isDownloading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
              Télécharger le PDF complet
            </button>
            <p className="text-center text-[11px] text-text-secondary pb-4">Les calculs fiscaux sont indicatifs. Consultez un expert-comptable.</p>
          </div>

          {/* Desktop PDF preview — hidden on phones */}
          <div className="flex-1 overflow-auto p-4 md:p-10 bg-bg/50 hidden md:flex justify-center items-start print:bg-white print:p-0 print:overflow-visible print:flex">
            <div className="shadow-2xl print:shadow-none origin-top" style={{ zoom: pdfZoom, width: '794px' } as React.CSSProperties}>
              <PDFReport
                 price={price} notaire={notaire} apport={effectiveApport}
                 taux={taux} duree={duree} loyer={loyer} cashflow={cashflow}
                 rendementBrut={rendementBrut} rendementNet={rendementNet}
                 monthlyTax={monthlyTax} mp={mp} regime={regime}
                 name={simName || `Simulation ${fmtK(price)}`}
                 revaluation={revaluation}
                 vacance={vacance}
                 inflationLoyers={inflationLoyers}
                 dpe={dpe}
                 listingUrl={listingUrl}
                 tmi={tmi}
                 travaux={travaux}
              />
            </div>
          </div>

          {/* Off-screen PDF source for html2canvas (always rendered, never display:none) */}
          <div style={{ position: 'fixed', left: '-9999px', top: 0, width: '794px', pointerEvents: 'none' }} aria-hidden="true">
            <div ref={reportRef}>
              <PDFReport
                 price={price} notaire={notaire} apport={effectiveApport}
                 taux={taux} duree={duree} loyer={loyer} cashflow={cashflow}
                 rendementBrut={rendementBrut} rendementNet={rendementNet}
                 monthlyTax={monthlyTax} mp={mp} regime={regime}
                 name={simName || `Simulation ${fmtK(price)}`}
                 revaluation={revaluation}
                 vacance={vacance}
                 inflationLoyers={inflationLoyers}
                 dpe={dpe}
                 listingUrl={listingUrl}
                 tmi={tmi}
                 travaux={travaux}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── PDF Report Component (Modern & Premium) ───────────────────

interface PrintableReportProps {
  price: number;
  loyer: number;
  notaire: number;
  taux: number;
  duree: number;
  apport: number;
  cashflow: number;
  rendementBrut: number;
  rendementNet: number;
  monthlyTax: number;
  mp: number;
  regime: string;
  name: string;
  revaluation: number;
  vacance: number;
  inflationLoyers: number;
  dpe: string;
  listingUrl: string;
  tmi: number;
  travaux: number;
}

function PDFReport({
  price, loyer, notaire, taux, duree, apport,
  cashflow, rendementBrut, rendementNet, monthlyTax, mp, regime, name,
  revaluation, inflationLoyers, dpe, listingUrl, tmi, travaux
}: PrintableReportProps) {
  const totalAcquisition = price + notaire + travaux;
  const principal = totalAcquisition - apport;
  
  // Amortissement calculation: 80% of property over 20 years (4% annual) + 10% of works over 10 years
  const annualAmortissementBien = price * 0.04;
  const annualAmortissementTravaux = travaux * 0.1; 
  const totalAnnualAmortissement = annualAmortissementBien + annualAmortissementTravaux;
  
  const annualChargesTotal = (price * 0.008) + 600 + 150 + (loyer * 12 * 0.025) + 300;
  const annualInterest = principal * (taux / 100);
  const totalAnnualDeductions = totalAnnualAmortissement + annualChargesTotal + annualInterest;
  
  // Financial Projection with Deficit Carryforward
  const projectionYearsArr = Array.from({ length: 20 }, (_, i) => i + 1);
  let accumulatedDeficit = 0;
  
  const fullProjection = projectionYearsArr.map(y => {
    const lYear = (loyer * 12) * Math.pow(1 + (inflationLoyers || 1.8) / 100, y - 1);
    const cYear = annualChargesTotal * Math.pow(1.015, y - 1);
    const capStart = calcRemainingCapital(principal, taux, duree, y - 1);
    const intYear = capStart * (taux / 100);
    const amortPropertyYear = (y <= 20) ? annualAmortissementBien : 0;
    const amortTravauxYear = (y <= 10) ? annualAmortissementTravaux : 0;
    const currentAmort = amortPropertyYear + amortTravauxYear;
    
    const totalDeductionsYear = cYear + intYear + currentAmort;
    const rawResult = lYear - totalDeductionsYear;
    
    let taxBase = 0;
    if (rawResult > 0) {
      const usedDeficit = Math.min(rawResult, accumulatedDeficit);
      taxBase = rawResult - usedDeficit;
      accumulatedDeficit -= usedDeficit;
    } else {
      accumulatedDeficit += Math.abs(rawResult);
      taxBase = 0;
    }
    
    const yearlyTax = regime.toLowerCase().includes("réel") 
      ? taxBase * (tmi + 0.172)
      : (lYear * (regime.toLowerCase().includes("micro-bic") ? 0.5 : 0.7)) * (tmi + 0.172);

    return { y, lYear, totalDeductionsYear, taxBase, yearlyTax, accumulatedDeficit };
  });

  const displayProjection = fullProjection.filter(p => [1, 5, 10, 15, 20].includes(p.y));

  return (
    <div className="bg-white print:block overflow-hidden">
      {/* Page 1: Analyse Financière */}
      <div className="p-10 space-y-8 bg-white text-slate-800 h-[29.7cm] relative flex flex-col font-sans border border-slate-100 print:border-none print:shadow-none print:m-0 print:overflow-hidden">
        {/* Header Accent */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-indigo-600 via-purple-500 to-emerald-400"></div>

        {/* Header Section */}
        <div className="flex justify-between items-start pt-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-lg">P</div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Propfolio <span className="text-indigo-600">Expert</span></h1>
            </div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-widest">{new Date().toLocaleDateString("fr-FR", { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold text-slate-900 leading-tight">{name}</h2>
            <p className="text-sm text-slate-500 font-medium">Analyse Financière Prévisionnelle</p>
            {listingUrl && (
              <p className="text-[10px] text-indigo-500 font-mono mt-1 underline truncate max-w-[250px]">{listingUrl}</p>
            )}
          </div>
        </div>

        {/* Hero Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Cashflow Mensuel", value: `${cashflow >= 0 ? "+" : "−"}${fmt(Math.abs(cashflow))} €`, color: cashflow >= 0 ? "text-emerald-600" : "text-rose-600", bg: cashflow >= 0 ? "bg-emerald-50" : "bg-rose-50" },
            { label: "Rendement Net", value: `${rendementNet.toFixed(2)} %`, color: "text-indigo-600", bg: "bg-indigo-50" },
            { label: "Apport", value: `${fmt(apport)} €`, color: "text-slate-700", bg: "bg-slate-50" },
            { label: "DPE", value: dpe || "N/A", color: "text-slate-700", bg: "bg-slate-50" }
          ].map((stat, i) => (
            <div key={i} className={`${stat.bg} p-4 rounded-2xl border border-white/50 shadow-sm`}>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{stat.label}</p>
              <p className={`text-xl font-black ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Main Columns */}
        <div className="grid grid-cols-12 gap-8 items-stretch flex-1">
          {/* Left Column */}
          <div className="col-span-7 space-y-6">
            <section className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-3">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                Structure de l&apos;Acquisition
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm"><span className="text-slate-500">Prix d&apos;achat</span><span className="font-semibold">{fmt(price)} €</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">Frais de notaire</span><span className="font-semibold">{fmt(notaire)} €</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">Travaux</span><span className="font-semibold">{fmt(travaux)} €</span></div>
                <div className="flex justify-between pt-2 border-t border-slate-200"><span className="font-bold">Total Projet</span><span className="font-black text-indigo-600">{fmt(totalAcquisition)} €</span></div>
              </div>
            </section>

            <section className="bg-white p-5 rounded-2xl border-2 border-indigo-100 space-y-4 shadow-sm">
              <h3 className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                Analyse Amortissable
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[9px] text-slate-400 font-bold uppercase">Immobilier (80%)</p>
                  <p className="text-sm font-black text-slate-700">{fmt(price * 0.8)} €</p>
                  <p className="text-[8px] text-slate-400 italic">Sur ~20 ans (5%/an)</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] text-slate-400 font-bold uppercase">Travaux & Mobilier</p>
                  <p className="text-sm font-black text-slate-700">{fmt(travaux)} €</p>
                  <p className="text-[8px] text-slate-400 italic">Sur ~10 ans (10%/an)</p>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                <p className="text-xs font-bold">Dotation Annuelle</p>
                <p className="text-lg font-black text-indigo-600">{fmt(totalAnnualAmortissement)} €</p>
              </div>
            </section>

            <section className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-4">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Bilan Fiscal Annuel
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm items-center">
                  <span className="text-slate-500 font-medium">Recettes annuelles</span>
                  <span className="font-black text-emerald-600">+{fmt(loyer * 12)} €</span>
                </div>
                <div className="space-y-2 p-3 bg-white/50 rounded-xl border border-slate-100">
                  <div className="flex justify-between text-[10px]"><span className="text-slate-400">- Charges & Taxes</span><span className="font-medium text-rose-400">-{fmt(annualChargesTotal)} €</span></div>
                  <div className="flex justify-between text-[10px]"><span className="text-slate-400">- Intérêts (Y1)</span><span className="font-medium text-rose-400">-{fmt(annualInterest)} €</span></div>
                  <div className="flex justify-between text-[10px] font-bold pt-1 border-t border-slate-100/50"><span className="text-slate-400">- Amortissements</span><span className="text-indigo-500">-{fmt(totalAnnualAmortissement)} €</span></div>
                </div>
                <div className="flex justify-between text-sm py-2 px-3 bg-slate-900 rounded-xl">
                  <span className="text-slate-400 text-[10px] font-bold uppercase">Résultat Fiscal</span>
                  <span className={`font-black ${loyer * 12 - totalAnnualDeductions > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                    {loyer * 12 - totalAnnualDeductions > 0 
                      ? `${fmt(loyer * 12 - totalAnnualDeductions)} €` 
                      : `DÉFICIT (${fmt(Math.abs(loyer * 12 - totalAnnualDeductions))} €)`
                    }
                  </span>
                </div>
              </div>
            </section>
          </div>

          {/* Right Column */}
          <div className="col-span-5 space-y-6">
            <section className="bg-slate-900 p-5 rounded-2xl text-white shadow-xl space-y-5">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300">Exploitation</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-400 text-xs">Loyer mensuel HC</span>
                  <span className="text-2xl font-black">{fmt(loyer)} €</span>
                </div>
                <div className="space-y-3 pt-4 border-t border-white/10">
                  <div className="flex justify-between text-[10px]"><span className="text-slate-400">Rendement Brut</span><span className="text-emerald-400 font-bold">{rendementBrut.toFixed(2)} %</span></div>
                  <div className="flex justify-between text-[10px]"><span className="text-slate-400">Rendement Net</span><span className="text-slate-200 font-bold">{rendementNet.toFixed(2)} %</span></div>
                  <div className="pt-2">
                    <div className="flex justify-between text-[10px] items-center">
                      <span className="text-slate-400">Impôt Mensuel</span>
                      <span className={`font-bold ${Math.round(monthlyTax) > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                        {Math.round(monthlyTax) > 0 ? `${fmt(monthlyTax)} €/m` : "0 € (Défiscalisé)"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-3">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Financement</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Emprunt</span><span>{fmt(principal)} €</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Taux</span><span>{taux} %</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Durée</span><span>{duree} ans</span></div>
                <div className="flex justify-between pt-2 border-t border-slate-200"><span className="font-bold">Mensualité</span><span className="font-black text-rose-500">{fmt(mp)} €/m</span></div>
              </div>
            </section>

            <div className="p-5 rounded-3xl border-2 border-dashed border-slate-100 text-center space-y-2">
               <TrendingUp size={24} className="mx-auto text-indigo-600 mb-1" />
               <p className="text-[10px] font-bold text-slate-400 uppercase">Valeur à 10 ans</p>
               <p className="text-lg font-black text-slate-900">+{revaluation}% <span className="text-slate-400 font-normal">/an</span></p>
            </div>
          </div>
        </div>

        {/* Footer P1 */}
        <div className="pt-6 border-t border-slate-100 flex justify-between items-end opacity-60">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-900 uppercase">Propfolio Expert Report</p>
            <p className="text-[7px] text-slate-400 max-w-xs leading-tight">Ce document est une projection basée sur vos hypothèses. Pas de valeur contractuelle.</p>
          </div>
          <p className="text-xs font-black text-slate-300">PAGE 1/2</p>
        </div>
      </div>

      {/* Page 2: Projection Table */}
      <div className="p-10 space-y-8 bg-white text-slate-800 h-[29.7cm] relative flex flex-col font-sans print:m-0 break-before-page print:overflow-hidden">
        <div className="flex justify-between items-end mb-4 pt-10">
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Analyse Prospective <span className="text-indigo-600">20 ans</span></h3>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{name}</p>
        </div>

        <section className="space-y-4 flex-1">
          <div className="overflow-hidden rounded-2xl border border-slate-100 shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Année</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Loyers</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Déductions</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Déficit Reporté</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Impôt Final</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {displayProjection.map((p, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900 text-sm">Année {p.y}</td>
                    <td className="px-6 py-4 text-right text-emerald-600 font-bold text-sm">{fmt(p.lYear)} €</td>
                    <td className="px-6 py-4 text-right text-rose-500/80 text-sm">-{fmt(p.totalDeductionsYear)} €</td>
                    <td className="px-6 py-4 text-right text-indigo-600 font-bold text-sm">{p.accumulatedDeficit > 0 ? `${fmt(p.accumulatedDeficit)} €` : "0 €"}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${p.yearlyTax > 0 ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>
                        {p.yearlyTax > 0 ? `${fmt(p.yearlyTax)} €` : "0 €"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-5 bg-indigo-50/30 rounded-2xl border border-indigo-100/50">
            <h4 className="text-xs font-black text-indigo-600 uppercase mb-2">Note sur le Report de Déficit</h4>
            <p className="text-[10px] text-slate-500 leading-relaxed italic">
              Le régime LMNP Réel permet de reporter indéfiniment vos déficits (amortissements non consommés). 
              Le tableau ci-dessus simule cette &quot;réserve fiscale&quot; qui annule votre impôt tant qu&apos;elle n&apos;est pas épuisée.
            </p>
          </div>
        </section>

        {/* Footer P2 */}
        <div className="pt-6 border-t border-slate-100 flex justify-between items-end opacity-60">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-900 uppercase">Propfolio Expert Report</p>
            <p className="text-[7px] text-slate-400 max-w-xs leading-tight">Généré le {new Date().toLocaleDateString()}. Document d&apos;aide à la décision uniquement.</p>
          </div>
          <div className="text-right flex items-center gap-4">
             <div className="px-3 py-1 bg-slate-100 text-[9px] font-black rounded-lg">ID_{Math.random().toString(36).substring(7).toUpperCase()}</div>
             <p className="text-xs font-black text-slate-300">PAGE 2/2</p>
          </div>
        </div>
      </div>
    </div>
  );
}
