"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Calendar,
  Receipt,
  Shield,
  FileText,
  TrendingDown,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { computeNetCashflow, getChargeAmounts } from "@/lib/calculations";
import type { Property, Loan, Charge, Revenue } from "@/lib/calculations";

// ── Types ─────────────────────────────────────────────────────

type AlertCategory = "loyer" | "echeance" | "cashflow";

type AlertSubtype =
  | "loyer"
  | "taxe_fonciere"
  | "pno"
  | "bail"
  | "cashflow_negatif";

type Alert = {
  id: string;
  category: AlertCategory;
  subtype: AlertSubtype;
  title: string;
  subtitle: string;
  date: Date | null;
  propertyId: string;
  propertyName: string;
};

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
};

// ── Helpers ───────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(Math.abs(n)));
}

const MONTHS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function fmtDate(d: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000);

  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Demain";
  if (diff > 0 && diff <= 7) return `Dans ${diff} jours`;
  if (diff > 0 && diff <= 31) return `Dans ${Math.round(diff / 7)} semaine${Math.round(diff / 7) > 1 ? "s" : ""}`;
  if (diff < 0) return `Le ${d.getDate()} ${MONTHS_FR[d.getMonth()]}`;
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

function nextAnnualDate(month: number, day = 1): Date {
  const now = new Date();
  const d = new Date(now.getFullYear(), month, day);
  if (d <= now) d.setFullYear(now.getFullYear() + 1);
  return d;
}

function nextPurchaseAnniversary(purchaseDate: string): Date {
  const base = new Date(purchaseDate);
  const now = new Date();
  const d = new Date(now.getFullYear(), base.getMonth(), base.getDate());
  if (d <= now) d.setFullYear(now.getFullYear() + 1);
  return d;
}

// ── Alert generation ──────────────────────────────────────────

function generateAlerts(entries: Entry[]): Alert[] {
  const alerts: Alert[] = [];
  const now = new Date();

  for (const { property, charges, revenue, cashflow } of entries) {
    // ── Loyer ────────────────────────────────────────────────
    const monthlyRent = revenue?.monthly_rent ?? 0;
    if (monthlyRent > 0) {
      // Show this month's 1st if before the 5th, otherwise next month's
      const loyerDate = new Date(now.getFullYear(), now.getMonth(), 1);
      if (now.getDate() > 5) loyerDate.setMonth(loyerDate.getMonth() + 1);

      alerts.push({
        id: `loyer-${property.id}`,
        category: "loyer",
        subtype: "loyer",
        title: "Loyer attendu",
        subtitle: `${fmt(monthlyRent)} €/mois · À percevoir`,
        date: loyerDate,
        propertyId: property.id,
        propertyName: property.name,
      });
    }

    // ── Taxe foncière — octobre ───────────────────────────────
    const { taxeFonciere } = getChargeAmounts(charges);
    if (taxeFonciere > 0) {
      alerts.push({
        id: `tf-${property.id}`,
        category: "echeance",
        subtype: "taxe_fonciere",
        title: "Taxe foncière",
        subtitle: `≈ ${fmt(taxeFonciere)} € estimée`,
        date: nextAnnualDate(9, 1), // October = month 9
        propertyId: property.id,
        propertyName: property.name,
      });
    }

    // ── PNO — anniversaire date achat ─────────────────────────
    const { pno } = getChargeAmounts(charges);
    if (pno > 0) {
      const pnoDate = property.purchase_date
        ? nextPurchaseAnniversary(property.purchase_date)
        : nextAnnualDate(now.getMonth() + 1, 1);

      alerts.push({
        id: `pno-${property.id}`,
        category: "echeance",
        subtype: "pno",
        title: "Assurance PNO — renouvellement",
        subtitle: `≈ ${fmt(pno)} €/an`,
        date: pnoDate,
        propertyId: property.id,
        propertyName: property.name,
      });
    }

    // ── Bail — 1 an après date achat ─────────────────────────
    if (property.purchase_date) {
      const bailBase = new Date(property.purchase_date);
      const bailDate = new Date(
        bailBase.getFullYear() + 1,
        bailBase.getMonth(),
        bailBase.getDate()
      );
      // Roll forward until future
      while (bailDate <= now) bailDate.setFullYear(bailDate.getFullYear() + 1);

      alerts.push({
        id: `bail-${property.id}`,
        category: "echeance",
        subtype: "bail",
        title: "Échéance de bail",
        subtitle: "Vérifier le renouvellement ou la reconduction tacite",
        date: bailDate,
        propertyId: property.id,
        propertyName: property.name,
      });
    }

    // ── Cashflow négatif ──────────────────────────────────────
    if (cashflow < 0) {
      alerts.push({
        id: `cf-${property.id}`,
        category: "cashflow",
        subtype: "cashflow_negatif",
        title: "Cashflow négatif",
        subtitle: `−${fmt(cashflow)} €/mois · Optimisez vos charges ou votre régime fiscal.`,
        date: null,
        propertyId: property.id,
        propertyName: property.name,
      });
    }
  }

  // Sort: cashflow alerts first, then chronological by date
  return alerts.sort((a, b) => {
    if (a.category === "cashflow" && b.category !== "cashflow") return -1;
    if (b.category === "cashflow" && a.category !== "cashflow") return 1;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.getTime() - b.date.getTime();
  });
}

// ── Alert config (colors + icons) ────────────────────────────

type AlertConfig = {
  icon: React.ElementType;
  iconColor: string;
  bgColor: string;
  borderColor: string;
  badgeLabel: string;
  badgeColor: string;
  badgeBg: string;
};

function getAlertConfig(subtype: AlertSubtype): AlertConfig {
  switch (subtype) {
    case "loyer":
      return {
        icon: Calendar,
        iconColor: "text-green",
        bgColor: "bg-green/10",
        borderColor: "border-green/20",
        badgeLabel: "Revenus",
        badgeColor: "text-green",
        badgeBg: "bg-green/15",
      };
    case "taxe_fonciere":
      return {
        icon: Receipt,
        iconColor: "text-[#F59E0B]",
        bgColor: "bg-[#F59E0B]/10",
        borderColor: "border-[#F59E0B]/20",
        badgeLabel: "Taxe",
        badgeColor: "text-[#F59E0B]",
        badgeBg: "bg-[#F59E0B]/15",
      };
    case "pno":
      return {
        icon: Shield,
        iconColor: "text-[#60A5FA]",
        bgColor: "bg-[#60A5FA]/10",
        borderColor: "border-[#60A5FA]/20",
        badgeLabel: "Assurance",
        badgeColor: "text-[#60A5FA]",
        badgeBg: "bg-[#60A5FA]/15",
      };
    case "bail":
      return {
        icon: FileText,
        iconColor: "text-accent",
        bgColor: "bg-accent/10",
        borderColor: "border-accent/20",
        badgeLabel: "Bail",
        badgeColor: "text-accent",
        badgeBg: "bg-accent/15",
      };
    case "cashflow_negatif":
      return {
        icon: TrendingDown,
        iconColor: "text-red",
        bgColor: "bg-red/10",
        borderColor: "border-red/20",
        badgeLabel: "Alerte",
        badgeColor: "text-red",
        badgeBg: "bg-red/15",
      };
  }
}

// ── Alert Card ────────────────────────────────────────────────

function AlertCard({ alert }: { alert: Alert }) {
  const cfg = getAlertConfig(alert.subtype);
  const Icon = cfg.icon;

  return (
    <Link href={`/biens/${alert.propertyId}`}>
      <div className="flex items-center gap-3 py-3.5 border-b border-border last:border-0 hover:bg-bg/40 -mx-1 px-1 rounded-lg transition-colors active:scale-[0.99]">
        {/* Icon badge */}
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${cfg.bgColor} ${cfg.borderColor}`}
        >
          <Icon size={17} className={cfg.iconColor} strokeWidth={1.8} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <p className="text-sm font-semibold text-text leading-tight">
              {alert.title}
            </p>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${cfg.badgeColor} ${cfg.badgeBg}`}
            >
              {cfg.badgeLabel}
            </span>
          </div>
          <p className="text-[11px] text-text-secondary truncate leading-snug">
            {alert.propertyName}
          </p>
          <p className="text-[11px] text-text-secondary leading-snug">
            {alert.subtitle}
          </p>
        </div>

        {/* Date + chevron */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          {alert.date && (
            <span className="text-[10px] font-mono font-medium text-text-secondary">
              {fmtDate(alert.date)}
            </span>
          )}
          <ChevronRight size={14} className="text-text-secondary" />
        </div>
      </div>
    </Link>
  );
}

// ── Empty state ───────────────────────────────────────────────

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-border/40 flex items-center justify-center mb-5">
        <Bell size={28} className="text-text-secondary" strokeWidth={1.4} />
      </div>
      <p className="text-base font-semibold text-text mb-2">
        {filtered ? "Aucune alerte dans cette catégorie" : "Aucune alerte pour l'instant"}
      </p>
      <p className="text-sm text-text-secondary leading-relaxed max-w-xs">
        {filtered
          ? "Essayez un autre filtre ou ajoutez un bien."
          : "Vos rappels de loyer, échéances et alertes cashflow apparaîtront ici."}
      </p>
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="px-4 pt-5 pb-8 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <div className="animate-pulse h-6 w-24 rounded-xl bg-border/40" />
        <div className="animate-pulse h-5 w-10 rounded-full bg-border/40" />
      </div>
      <div className="animate-pulse h-10 rounded-xl bg-border/40" />
      <div className="bg-card rounded-2xl border border-border divide-y divide-border">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 p-4">
            <div className="animate-pulse w-10 h-10 rounded-xl bg-border/40 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="animate-pulse h-3.5 w-32 rounded bg-border/40" />
              <div className="animate-pulse h-3 w-48 rounded bg-border/40" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Filter tabs ───────────────────────────────────────────────

const FILTERS: { label: string; value: AlertCategory | "all" }[] = [
  { label: "Toutes", value: "all" },
  { label: "Loyers", value: "loyer" },
  { label: "Échéances", value: "echeance" },
  { label: "Alertes", value: "cashflow" },
];

// ── Page ─────────────────────────────────────────────────────

export default function AlertesPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AlertCategory | "all">("all");

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

      const entries: Entry[] = properties.map((p) => {
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
          cashflow: computeNetCashflow(
            p as Property,
            loan,
            propCharges,
            revenue
          ),
        };
      });

      setAlerts(generateAlerts(entries));
      setLoading(false);
    }

    load();
  }, []);

  if (loading) return <LoadingSkeleton />;

  const filtered =
    filter === "all" ? alerts : alerts.filter((a) => a.category === filter);

  const cashflowCount = alerts.filter((a) => a.category === "cashflow").length;

  return (
    <div className="px-4 pt-5 pb-8 max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-text">Alertes</h1>
        {alerts.length > 0 && (
          <span
            className={`font-mono text-xs font-bold px-2.5 py-1 rounded-full ${
              cashflowCount > 0
                ? "bg-red/15 text-red"
                : "bg-accent/15 text-accent"
            }`}
          >
            {alerts.length}
          </span>
        )}
      </div>

      {alerts.length === 0 ? (
        <EmptyState filtered={false} />
      ) : (
        <>
          {/* Filter tabs */}
          <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
            {FILTERS.map(({ label, value }) => {
              const count =
                value === "all"
                  ? alerts.length
                  : alerts.filter((a) => a.category === value).length;
              const active = filter === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold shrink-0 border transition-all ${
                    active
                      ? "bg-accent text-white border-accent"
                      : "bg-card text-text-secondary border-border hover:border-accent/40 hover:text-text"
                  }`}
                >
                  {label}
                  {count > 0 && (
                    <span
                      className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full ${
                        active
                          ? "bg-white/20 text-white"
                          : "bg-border text-text-secondary"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Alert list */}
          {filtered.length === 0 ? (
            <EmptyState filtered />
          ) : (
            <div className="bg-card rounded-2xl border border-border px-4">
              {filtered.map((alert) => (
                <AlertCard key={alert.id} alert={alert} />
              ))}
            </div>
          )}

          {/* MVP notice */}
          <div className="flex gap-3 p-4 bg-accent/5 border border-accent/15 rounded-2xl">
            <Bell size={14} className="text-accent shrink-0 mt-0.5" />
            <p className="text-xs text-text-secondary leading-relaxed">
              Les alertes sont générées à partir de vos données. Les
              notifications push seront disponibles prochainement.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
