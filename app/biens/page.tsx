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
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { computeNetCashflow, computeScoreDetails } from "@/lib/calculations";
import type { Property, Loan, Charge, Revenue } from "@/lib/calculations";

// ── Extended types (include property_id for Supabase joins) ───

type DashLoan = Loan & { property_id: string };
type DashCharge = Charge & { property_id: string };
type DashRevenue = Revenue & { property_id: string };

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
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-20 h-20 rounded-3xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-6">
        <Building2 size={36} className="text-accent" strokeWidth={1.4} />
      </div>
      <h2 className="text-lg font-bold text-text mb-2">
        Aucun bien pour l&apos;instant
      </h2>
      <p className="text-sm text-text-secondary leading-relaxed mb-8 max-w-xs">
        Ajoutez votre premier bien pour découvrir votre cashflow réel et piloter
        votre patrimoine.
      </p>
      <Link
        href="/biens/nouveau"
        className="px-6 py-3 rounded-xl text-sm font-semibold text-white flex items-center gap-2 active:scale-[0.98] transition-transform"
        style={{ background: "linear-gradient(135deg, #6C63FF 0%, #00D9A6 100%)" }}
      >
        <Plus size={16} />
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
      <div className="bg-card rounded-2xl border border-border overflow-hidden hover:border-accent/30 transition-colors active:scale-[0.99]">
        {/* Score bar */}
        <div className={`h-[3px] ${style.bar}`} />

        <div className="p-4">
          {/* Top row */}
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-bg flex items-center justify-center text-accent shrink-0">
              <Icon size={18} strokeWidth={1.8} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text truncate">
                {property.name}
              </p>
              <p className="text-[11px] text-text-secondary mt-0.5">
                {TYPE_LABEL[property.type] ?? property.type}
                {property.surface ? ` · ${property.surface} m²` : ""}
                {property.regime
                  ? ` · ${REGIME_SHORT[property.regime] ?? property.regime}`
                  : ""}
              </p>
            </div>
            {property.dpe && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
                style={{
                  background: { A: "#319834", B: "#33CC33", C: "#CBFC01", D: "#FFFF00", E: "#FFCC00", F: "#FF6600", G: "#FF0000" }[property.dpe] ?? "#888",
                  color: property.dpe <= "C" ? "#000" : "#000"
                }}
              >
                DPE {property.dpe}
              </span>
            )}
            <div
              className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${style.text} ${style.bg}`}
            >
              {score}/100
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border">
            <div>
              <p className="text-[10px] text-text-secondary mb-0.5">Loyer</p>
              <p className="font-mono text-xs font-bold text-text">
                {monthlyRent > 0 ? `${fmt(monthlyRent)} €` : "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-text-secondary mb-0.5">
                Cashflow net
              </p>
              <p
                className={`font-mono text-xs font-bold ${
                  cfPositive ? "text-green" : "text-red"
                }`}
              >
                {cfPositive ? "+" : "−"}
                {fmt(cashflow)} €
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-text-secondary mb-0.5">Valeur</p>
              <p className="font-mono text-xs font-bold text-text">
                {fmtValue(property.current_value)}
              </p>
            </div>
          </div>

          {/* Market price row */}
          {marketPrixM2 && (
            <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[10px] text-text-secondary">
                <TrendingUp size={11} className="text-accent" />
                <span>Marché local</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-bold text-text">
                  {Math.round(marketPrixM2).toLocaleString("fr-FR")} €/m²
                </span>
                {delta !== null && (
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      delta > 5
                        ? "bg-red/10 text-red"
                        : delta < -5
                        ? "bg-green/10 text-green"
                        : "bg-border text-text-secondary"
                    }`}
                  >
                    {delta > 0 ? "+" : ""}
                    {delta.toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="px-4 pb-3 flex justify-end">
          <ChevronRight size={14} className="text-text-secondary" />
        </div>
      </div>
    </Link>
  );
}

function AddPropertyCard() {
  return (
    <Link href="/biens/nouveau">
      <div className="rounded-2xl border-2 border-dashed border-border hover:border-accent/40 transition-colors p-6 flex flex-col items-center justify-center gap-2 text-text-secondary hover:text-text active:scale-[0.99]">
        <div className="w-10 h-10 rounded-xl bg-bg border border-border flex items-center justify-center">
          <Plus size={18} />
        </div>
        <p className="text-sm font-medium">Ajouter un bien</p>
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

      // Fetch market prices in background for properties with addresses
      const withAddress = result.filter(
        (c) => c.property.address && c.property.address.length > 5
      );
      if (withAddress.length === 0) return;

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
    <div className="px-4 pt-5 pb-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-text leading-tight">
            Mes biens
          </h1>
          {cards.length > 0 && (
            <p className="text-text-secondary text-sm mt-0.5">
              {cards.length} bien{cards.length > 1 ? "s" : ""} ·{" "}
              {fmtValue(totalPatrimoine)} de patrimoine
            </p>
          )}
        </div>
        {cards.length > 0 && (
          <Link
            href="/biens/nouveau"
            className="flex items-center gap-1.5 bg-accent text-white text-xs font-semibold px-3 py-2 rounded-xl hover:opacity-90 active:scale-[0.98] transition-all"
          >
            <Plus size={14} />
            Ajouter
          </Link>
        )}
      </div>

      {cards.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {cards.map((card) => (
            <PropertyCard
              key={card.property.id}
              card={card}
              marketPrixM2={prixM2Map[card.property.id] ?? null}
            />
          ))}
          <AddPropertyCard />
        </div>
      )}
    </div>
  );
}
