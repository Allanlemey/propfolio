"use client";

import { useEffect, useState } from "react";
import { useUserTmi } from "@/hooks/use-user-tmi";
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
  ArrowUpDown,
  Check,
  ArrowUpRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { computeNetCashflow, computeScoreDetails } from "@/lib/calculations";
import type { Property, Loan, Charge, Revenue } from "@/lib/calculations";

// ── Extended types (include property_id for Supabase joins) ───

type PropertyCard = {
  property: Property;
  loan: Loan | null;
  charges: Charge[];
  revenue: Revenue | null;
  cashflow: number;
  score: number;
};

// ── Helpers ───────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(Math.abs(n)));
}

function fmtValue(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(".", ",") + " M€";
  if (n >= 1_000) return Math.round(n / 1_000) + " K€";
  return fmt(n) + " €";
}

function scoreStyle(score: number) {
  if (score >= 75)
    return { text: "text-green", bg: "bg-green/15", bar: "bg-green" };
  if (score >= 50)
    return { text: "text-accent", bg: "bg-accent/15", bar: "bg-accent" };
  if (score >= 30)
    return {
      text: "text-[#FBBF24]",
      bg: "bg-[#FBBF24]/15",
      bar: "bg-[#FBBF24]",
    };
  return { text: "text-red", bg: "bg-red/15", bar: "bg-red" };
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  appartement: Building2,
  maison: Home,
  studio: Building,
  immeuble: Warehouse,
  commercial: Store,
};

const TYPE_LABEL: Record<string, string> = {
  appartement: "Appartement",
  maison: "Maison",
  studio: "Studio",
  immeuble: "Immeuble",
  commercial: "Local commercial",
};

const REGIME_SHORT: Record<string, string> = {
  "LMNP micro-BIC": "LMNP µ-BIC",
  "LMNP réel": "LMNP réel",
  "Nu micro-foncier": "Nu µ-foncier",
  "Nu réel": "Nu réel",
};

// ── Components ────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <div className="w-24 h-24 rounded-[32px] flex items-center justify-center mb-8 relative"
        style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(16,185,129,0.15) 100%)", border: "1px solid rgba(99,102,241,0.25)" }}>
        <div className="absolute inset-0 blur-2xl bg-accent/20 rounded-full animate-pulse" />
        <Building2 size={40} className="text-accent relative z-10" strokeWidth={1.5} />
      </div>
      <h2 className="text-xl font-black text-text mb-3 tracking-tight">Optimisez votre gestion immobilière</h2>
      <p className="text-sm text-text-secondary leading-relaxed mb-10 max-w-xs font-medium">
        Analysez la rentabilité nette, suivez le cashflow réel et valorisez votre patrimoine avec précision.
      </p>
      <Link
        href="/biens/nouveau"
        className="px-8 py-4 rounded-2xl text-sm font-black uppercase tracking-wider text-white flex items-center gap-3 active:scale-[0.98] transition-all shadow-xl shadow-accent/25 hover:shadow-accent/40"
        style={{ background: "linear-gradient(135deg, var(--accent) 0%, #818CF8 100%)" }}
      >
        <Plus size={18} strokeWidth={3} />
        Ajouter mon premier bien
      </Link>
    </div>
  );
}

function PropertyCard({
  card,
  marketPrixM2,
}: {
  card: PropertyCard;
  marketPrixM2?: number | null;
}) {
  const { property, revenue, cashflow, score } = card;
  const Icon = TYPE_ICONS[property.type] ?? Building2;
  const style = scoreStyle(score);
  const cfPositive = cashflow >= 0;
  const monthlyRent = revenue?.monthly_rent ?? 0;

  const propM2 =
    property.surface && property.surface > 0
      ? property.current_value / property.surface
      : null;

  const delta =
    marketPrixM2 && propM2
      ? ((propM2 - marketPrixM2) / marketPrixM2) * 100
      : null;

  return (
    <Link href={`/biens/${property.id}`}>
      <div className="bg-card rounded-[26px] border border-border/60 overflow-hidden hover:border-accent/40 transition-all duration-300 group shadow-sm premium-shadow hover:-translate-y-1 active:scale-[0.99] relative">
        <div className={`absolute top-0 left-0 right-0 h-1 ${style.bar} opacity-80`} />
        
        <div className="p-5">
          {/* Header row */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-bg flex items-center justify-center text-accent shrink-0 border border-border shadow-sm group-hover:border-accent/30 transition-colors">
                    <Icon size={22} strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-base font-black text-text truncate group-hover:text-accent transition-colors leading-tight">
                        {property.name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">
                            {TYPE_LABEL[property.type] ?? property.type}
                        </span>
                        <div className="w-1 h-1 rounded-full bg-border" />
                        <span className="text-[10px] font-bold text-text-secondary">
                            {property.surface ? `${property.surface} m²` : "Surface inconnue"}
                        </span>
                        {property.regime && (
                            <>
                                <div className="w-1 h-1 rounded-full bg-border" />
                                <span className="text-[10px] font-bold text-accent/80">
                                    {REGIME_SHORT[property.regime] ?? property.regime}
                                </span>
                            </>
                        )}
                    </div>
                </div>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider ${style.text} ${style.bg}`}>
                    Score {score}
                </div>
                {property.dpe && (
                    <span
                        className="text-[9px] font-black px-2 py-0.5 rounded-md shrink-0 uppercase tracking-tighter shadow-sm border border-black/5"
                        style={{
                            background: { A: "#319834", B: "#33CC33", C: "#CBFC01", D: "#FFFF00", E: "#FFCC00", F: "#FF6600", G: "#FF0000" }[property.dpe] ?? "#888",
                            color: "rgba(0,0,0,0.8)"
                        }}
                    >
                        Classe {property.dpe}
                    </span>
                )}
            </div>
          </div>

          {/* KPI Grid */}
          <div className="grid grid-cols-3 gap-3 p-4 bg-bg/50 rounded-2xl border border-border/40 backdrop-blur-sm">
            <div className="space-y-1">
                <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">Loyer mensuel</p>
                <p className="font-mono text-sm font-black text-text">
                    {monthlyRent > 0 ? `${fmt(monthlyRent)}€` : "—"}
                </p>
            </div>
            <div className="space-y-1">
                <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">Cashflow net</p>
                <div className="flex items-center gap-1">
                    <p className={`font-mono text-sm font-black ${cfPositive ? "text-green" : "text-red"}`}>
                        {cfPositive ? "+" : "−"}{fmt(cashflow)}€
                    </p>
                    {cfPositive && <TrendingUp size={12} className="text-green opacity-80" />}
                </div>
            </div>
            <div className="space-y-1 text-right">
                <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">Valeur actifs</p>
                <p className="font-mono text-sm font-black text-text">
                    {fmtValue(property.current_value)}
                </p>
            </div>
          </div>

          {/* Market Insights */}
          {marketPrixM2 && (
            <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] font-bold text-text-secondary italic">
                <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                Diagnostic Marché
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                    <p className="text-[11px] font-black text-text">
                      {Math.round(marketPrixM2).toLocaleString("fr-FR")} €/m²
                    </p>
                    <p className="text-[8px] text-text-muted uppercase font-bold tracking-tighter">Prix local moyen</p>
                </div>
                {delta !== null && (
                  <div className={`px-2 py-1 rounded-lg text-[10px] font-black shadow-sm flex items-center gap-1 ${
                    delta > 5 ? "bg-red/5 text-red" : delta < -5 ? "bg-green/5 text-green" : "bg-bg text-text-secondary"
                  }`}>
                    {delta > 0 ? "+" : ""}{delta.toFixed(0)}%
                    <ArrowUpRight size={10} strokeWidth={3} className={delta > 5 ? "rotate-45" : delta < -5 ? "-rotate-45" : ""} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
            <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shadow-sm">
                <ChevronRight size={14} strokeWidth={3} />
            </div>
        </div>
      </div>
    </Link>
  );
}

// ── Page ─────────────────────────────────────────────────────

export default function BiensPage() {
  const tmi = useUserTmi();
  const [cards, setCards] = useState<PropertyCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [prixM2Map, setPrixM2Map] = useState<Record<string, number>>({});
  
  // Sorting
  type SortKey = "name" | "value" | "cashflow" | "surface" | "score";
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [sortOpen, setSortOpen] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: props } = await supabase
        .from("properties")
        .select("*")
        .order("created_at", { ascending: false });

      if (!props || props.length === 0) {
        setLoading(false);
        return;
      }

      const ids = props.map((p) => p.id);

      const [{ data: loans }, { data: charges }, { data: revenues }] =
        await Promise.all([
          supabase
            .from("loans")
            .select("property_id, monthly_payment")
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

      const result: PropertyCard[] = props.map((p) => {
        const loan = loans?.find((l) => l.property_id === p.id) ?? null;
        const propCharges =
          charges?.filter((c) => c.property_id === p.id) ?? [];
        const revenue =
          revenues?.find((r) => r.property_id === p.id) ?? null;

        return {
          property: p,
          loan,
          charges: propCharges,
          revenue,
          cashflow: computeNetCashflow(p as Property, loan, propCharges as Charge[], revenue, tmi),
          score: computeScoreDetails(p as Property, loan, propCharges as Charge[], revenue, tmi).global,
        };
      });

      setCards(result);
      setLoading(false);

      // Fetch market prices
      const withAddress = result.filter(
        (c) => c.property.address && c.property.address.length > 5
      );
      
      if (withAddress.length > 0) {
        const fetches = withAddress.map(async (c) => {
          try {
            const res = await fetch(
              `/api/prix-m2?address=${encodeURIComponent(c.property.address!)}`
            );
            if (res.ok) {
              const data = await res.json();
              return { id: c.property.id, prixM2: data.prixM2 as number };
            }
          } catch {
            // silently skip
          }
          return null;
        });

        const results = await Promise.all(fetches);
        const map: Record<string, number> = {};
        results.forEach((r) => {
          if (r) map[r.id] = r.prixM2;
        });
        setPrixM2Map(map);
      }
    }

    load();
  }, [tmi]);

  const totalPatrimoine = cards.reduce(
    (sum, c) => sum + c.property.current_value,
    0
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-bg overflow-x-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 inset-x-0 h-[400px] bg-gradient-to-b from-accent/5 to-transparent pointer-events-none" />
      <div className="absolute top-20 right-[-10%] w-[40%] h-[20%] bg-accent/10 rounded-full blur-[100px] pointer-events-none" />
      
      <div className="relative px-4 pt-8 pb-12 max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-end justify-between px-1">
          <div className="space-y-1">
            <h1 className="text-2xl font-black text-text tracking-tight leading-none bg-gradient-to-r from-text to-text-secondary bg-clip-text text-transparent">Mes biens</h1>
            <div className="text-text-muted text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                Portefeuille Actif
            </div>
          </div>
          {cards.length > 0 && (
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    onClick={() => setSortOpen(!sortOpen)}
                    className="flex items-center gap-1.5 bg-card border border-border text-text-secondary text-[10px] font-black uppercase tracking-wider px-3 py-2 rounded-xl hover:text-text hover:border-accent/40 active:scale-[0.98] transition-all shadow-sm"
                  >
                    <ArrowUpDown size={12} />
                    Trier
                  </button>
                  {sortOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setSortOpen(false)} />
                      <div className="absolute right-0 top-full mt-2 w-48 bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden py-2 animate-in fade-in slide-in-from-top-2">
                        <p className="px-4 py-2 text-[10px] font-black text-text-muted uppercase tracking-widest border-b border-border/50 mb-1">Critère de tri</p>
                        {[
                          { key: "name", label: "Nom" },
                          { key: "value", label: "Valeur actuelle" },
                          { key: "cashflow", label: "Cashflow net" },
                          { key: "score", label: "Score global" },
                          { key: "surface", label: "Surface" },
                        ].map((opt) => (
                          <button
                            key={opt.key}
                            onClick={() => {
                              setSortBy(opt.key as SortKey);
                              setSortOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-4 py-2.5 text-[11px] text-left transition-colors font-bold ${
                              sortBy === opt.key ? "text-accent bg-accent/5" : "text-text-secondary hover:bg-bg hover:text-text"
                            }`}
                          >
                            {opt.label}
                            {sortBy === opt.key && <Check size={14} strokeWidth={3} />}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <Link
                  href="/biens/nouveau"
                  className="flex items-center gap-1.5 bg-accent text-white text-[10px] font-black uppercase tracking-wider px-4 py-2 rounded-xl hover:opacity-90 active:scale-[0.98] transition-all shadow-lg shadow-accent/20"
                >
                  <Plus size={12} strokeWidth={3} />
                  Ajouter
                </Link>
              </div>
              <span className="text-[9px] text-text-muted font-bold mr-1">
                {cards.length} BIEN{cards.length > 1 ? "S" : ""} · {fmtValue(totalPatrimoine)} TOTAL
              </span>
            </div>
          )}
        </div>

        {cards.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-4">
            {[...cards]
              .sort((a, b) => {
                if (sortBy === "name") return a.property.name.localeCompare(b.property.name);
                if (sortBy === "value") return b.property.current_value - a.property.current_value;
                if (sortBy === "cashflow") return b.cashflow - a.cashflow;
                if (sortBy === "score") return b.score - a.score;
                if (sortBy === "surface") return (b.property.surface ?? 0) - (a.property.surface ?? 0);
                return 0;
              })
              .map((card) => (
                <PropertyCard
                  key={card.property.id}
                  card={card}
                  marketPrixM2={prixM2Map[card.property.id] ?? null}
                />
              ))}
            
            <Link href="/biens/nouveau">
              <div className="rounded-[22px] border-2 border-dashed border-border/60 hover:border-accent/40 bg-card/50 hover:bg-card transition-all p-8 flex flex-col items-center justify-center gap-3 text-text-secondary hover:text-text active:scale-[0.99] group shadow-sm">
                <div className="w-12 h-12 rounded-2xl bg-bg border border-border flex items-center justify-center group-hover:bg-accent group-hover:text-white group-hover:border-transparent transition-all duration-300">
                  <Plus size={20} strokeWidth={2.5} />
                </div>
                <p className="text-sm font-bold tracking-tight">Ajouter un nouveau bien immobilier</p>
                <p className="text-[11px] text-text-muted font-medium">Commencez dès maintenant un nouveau diagnostic</p>
              </div>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
