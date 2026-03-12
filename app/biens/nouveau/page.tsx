"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, X, Check, Loader2, Info, AlertTriangle, TrendingUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { calcRemainingCapital } from "@/lib/calculations";

// ── Helpers ───────────────────────────────────────────────────

const MOIS: Record<string, string> = {
  janvier: "01", février: "02", fevrier: "02", mars: "03",
  avril: "04", mai: "05", juin: "06", juillet: "07",
  août: "08", aout: "08", septembre: "09", octobre: "10",
  novembre: "11", décembre: "12", decembre: "12",
};

function parseFrenchDate(s: string): string | null {
  const parts = s.trim().toLowerCase().split(/\s+/);
  if (parts.length !== 2) return null;
  const month = MOIS[parts[0]];
  const year = parts[1];
  if (!month || !/^\d{4}$/.test(year)) return null;
  return `${year}-${month}-01`;
}

// ── Types ─────────────────────────────────────────────────────

interface FormData {
  // Step 1
  name: string;
  address_number: string;
  address_street: string;
  address_city: string;
  address_postal: string;
  type: string;
  surface: string;
  purchase_price: string;
  current_value: string;
  purchase_date: string;
  dpe: string;
  // Step 2
  has_loan: boolean;
  loan_amount: string;
  loan_rate: string;
  loan_duration: string;
  loan_start_date: string; // YYYY-MM
  // Step 3
  monthly_rent: string;
  regime: string;
  // Step 4
  taxe_fonciere: string;
  copro: string;
  pno: string;
  gli: string;
}

const INITIAL: FormData = {
  name: "",
  address_number: "",
  address_street: "",
  address_city: "",
  address_postal: "",
  type: "",
  surface: "",
  purchase_price: "",
  current_value: "",
  purchase_date: "",
  dpe: "",
  has_loan: true,
  loan_amount: "",
  loan_rate: "",
  loan_duration: "",
  loan_start_date: "",
  monthly_rent: "",
  regime: "",
  taxe_fonciere: "",
  copro: "",
  pno: "",
  gli: "",
};

const STEP_TITLES = ["Le bien", "Le crédit", "Les revenus", "Les charges"];

const PROPERTY_TYPES = [
  { value: "appartement", label: "Appartement" },
  { value: "maison", label: "Maison" },
  { value: "studio", label: "Studio" },
  { value: "immeuble", label: "Immeuble" },
  { value: "commercial", label: "Local commercial" },
];

const REGIMES = ["LMNP micro-BIC", "LMNP réel", "Nu micro-foncier", "Nu réel"];

const DPE_LETTERS = ["A", "B", "C", "D", "E", "F", "G"] as const;
const DPE_COLORS: Record<string, string> = {
  A: "#319834", B: "#33CC33", C: "#CBFC01",
  D: "#FFFF00", E: "#FFCC00", F: "#FF6600", G: "#FF0000",
};

// ── Helpers ───────────────────────────────────────────────────

function computeMonthlyPayment(
  amount: number,
  annualRate: number,
  durationYears: number
): number {
  const r = annualRate / 100 / 12;
  const n = durationYears * 12;
  if (n === 0) return 0;
  if (r === 0) return amount / n;
  return (amount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n));
}

// ── Field component ───────────────────────────────────────────

function Field({
  label,
  suffix,
  hint,
  disabled,
  ...props
}: {
  label: string;
  suffix?: string;
  hint?: string;
  disabled?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={`space-y-1.5 ${disabled ? "opacity-40" : ""}`}>
      <label className="block text-xs font-medium text-text-secondary">
        {label}
      </label>
      <div className="relative">
        <input
          {...props}
          disabled={disabled}
          className={`w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm text-text placeholder:text-text-secondary focus:outline-none focus:border-accent transition-colors disabled:cursor-not-allowed ${
            suffix ? "pr-16" : ""
          }`}
        />
        {suffix && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-text-secondary font-medium pointer-events-none select-none">
            {suffix}
          </span>
        )}
      </div>
      {hint && <p className="text-[11px] text-text-secondary">{hint}</p>}
    </div>
  );
}

// ── Step 1 — Le bien ──────────────────────────────────────────

type PrixEstResult = {
  prixM2: number;
  min: number;
  max: number;
  count: number;
  city: string;
  radiusKm: number;
  lastUpdate: string | null;
};

function Step1({
  data,
  update,
}: {
  data: FormData;
  update: (field: keyof FormData, value: string) => void;
}) {
  const [prixEst, setPrixEst] = useState<PrixEstResult | null>(null);
  const [estimLoading, setEstimLoading] = useState(false);
  const [estimError, setEstimError] = useState<string | null>(null);

  async function estimatePrix() {
    const address = [
      data.address_number.trim(),
      data.address_street.trim(),
      data.address_postal.trim(),
      data.address_city.trim(),
    ]
      .filter(Boolean)
      .join(" ");
    if (address.length < 5) return;
    setEstimLoading(true);
    setEstimError(null);
    setPrixEst(null);
    try {
      const res = await fetch(`/api/prix-m2?address=${encodeURIComponent(address)}`);
      const json = await res.json();
      if (res.ok) {
        setPrixEst(json);
      } else {
        setEstimError(json.error ?? "Données indisponibles pour cette zone");
      }
    } catch {
      setEstimError("Erreur réseau");
    } finally {
      setEstimLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Field
        label="Nom du bien"
        type="text"
        placeholder="Studio Gambetta, T2 Belleville…"
        value={data.name}
        onChange={(e) => update("name", e.target.value)}
        required
      />
      {/* Adresse structurée */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-text-secondary">Adresse</p>
        <div className="grid grid-cols-3 gap-2">
          <Field
            label="N°"
            type="text"
            placeholder="15"
            value={data.address_number}
            onChange={(e) => update("address_number", e.target.value)}
          />
          <div className="col-span-2">
            <Field
              label="Rue"
              type="text"
              placeholder="rue de la Paix"
              value={data.address_street}
              onChange={(e) => update("address_street", e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field
            label="Code postal"
            type="text"
            placeholder="75002"
            value={data.address_postal}
            onChange={(e) => { update("address_postal", e.target.value); setPrixEst(null); setEstimError(null); }}
            maxLength={5}
          />
          <Field
            label="Ville"
            type="text"
            placeholder="Paris"
            value={data.address_city}
            onChange={(e) => { update("address_city", e.target.value); setPrixEst(null); setEstimError(null); }}
          />
        </div>

        {/* Prix marché */}
        <button
          type="button"
          onClick={estimatePrix}
          disabled={estimLoading || [data.address_street, data.address_city, data.address_postal].every((v) => !v.trim())}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-accent/30 bg-accent/5 text-accent text-sm font-semibold hover:bg-accent/10 transition-colors disabled:opacity-40"
        >
          {estimLoading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <TrendingUp size={14} />
          )}
          Estimer le prix du marché local
        </button>

        {prixEst && (
          <div className="p-3 bg-accent/5 border border-accent/20 rounded-xl">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-accent">
                Marché — {prixEst.city}
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
            {data.surface && parseFloat(data.surface) > 0 && (
              <div className="mt-2 pt-2 border-t border-accent/15 flex justify-between">
                <span className="text-xs text-text-secondary">Estimation pour {data.surface} m²</span>
                <span className="text-xs font-mono font-bold text-green">
                  ~{Math.round(prixEst.prixM2 * parseFloat(data.surface)).toLocaleString("fr-FR")} €
                </span>
              </div>
            )}
          </div>
        )}

        {estimError && (
          <p className="text-[11px] text-red px-1">{estimError}</p>
        )}
      </div>

      {/* Type */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-text-secondary">Type de bien</p>
        <div className="flex flex-wrap gap-2">
          {PROPERTY_TYPES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => update("type", value)}
              className={`text-sm px-3 py-2 rounded-xl border transition-colors font-medium ${
                data.type === value
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-border text-text-secondary hover:border-accent/40 hover:text-text"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* DPE */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-text-secondary">Classe énergie (DPE)</p>
        <div className="flex gap-1.5">
          {DPE_LETTERS.map(letter => {
            const selected = data.dpe === letter;
            const color = DPE_COLORS[letter];
            return (
              <button
                key={letter}
                type="button"
                onClick={() => update("dpe", data.dpe === letter ? "" : letter)}
                className="flex-1 py-2 rounded-lg text-sm font-bold transition-all border"
                style={{
                  background: selected ? color : "transparent",
                  borderColor: selected ? color : "var(--border)",
                  color: selected ? (letter <= "C" ? "#000" : "#000") : "var(--text-secondary)",
                  opacity: selected ? 1 : 0.6,
                  boxShadow: selected ? `0 2px 8px ${color}55` : "none",
                }}
              >
                {letter}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-text-secondary">Optionnel — visible sur la fiche du bien</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Surface"
          type="number"
          placeholder="45"
          suffix="m²"
          value={data.surface}
          onChange={(e) => update("surface", e.target.value)}
          min="1"
        />
        <Field
          label="Date d'achat"
          type="text"
          placeholder="Mars 2022"
          value={data.purchase_date}
          onChange={(e) => update("purchase_date", e.target.value)}
        />
      </div>

      <Field
        label="Prix d'achat (frais inclus)"
        type="number"
        placeholder="200 000"
        suffix="€"
        value={data.purchase_price}
        onChange={(e) => update("purchase_price", e.target.value)}
        required
        min="1"
      />
      <Field
        label="Valeur actuelle estimée"
        type="number"
        placeholder="220 000"
        suffix="€"
        value={data.current_value}
        onChange={(e) => update("current_value", e.target.value)}
        hint="Laissez vide pour utiliser le prix d'achat"
      />
    </div>
  );
}

// ── Step 2 — Le crédit ────────────────────────────────────────

function computeRemainingFromDate(
  amount: number, rate: number, durationYears: number, startDate: string
): { remaining: number; monthsElapsed: number; pct: number } | null {
  if (!startDate) return null;
  const [y, m] = startDate.split("-").map(Number);
  if (!y || !m) return null;
  const now = new Date();
  const monthsElapsed = (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m);
  if (monthsElapsed <= 0) return null;
  const totalMonths = durationYears * 12;
  if (monthsElapsed >= totalMonths) return { remaining: 0, monthsElapsed: totalMonths, pct: 100 };
  const remaining = calcRemainingCapital(amount, rate, durationYears, monthsElapsed / 12);
  const pct = ((amount - remaining) / amount) * 100;
  return { remaining, monthsElapsed, pct };
}

function Step2({
  data,
  update,
  setHasLoan,
}: {
  data: FormData;
  update: (field: keyof FormData, value: string) => void;
  setHasLoan: (v: boolean) => void;
}) {
  const amount = parseFloat(data.loan_amount) || 0;
  const rate = parseFloat(data.loan_rate) || 0;
  const duration = parseFloat(data.loan_duration) || 0;

  const monthly =
    data.has_loan && amount && rate && duration
      ? computeMonthlyPayment(amount, rate, duration)
      : null;

  const repayment =
    data.has_loan && amount && rate && duration && data.loan_start_date
      ? computeRemainingFromDate(amount, rate, duration, data.loan_start_date)
      : null;

  return (
    <div className="space-y-4">
      <div className="flex gap-3 p-4 bg-accent/5 border border-accent/20 rounded-xl">
        <Info size={16} className="text-accent shrink-0 mt-0.5" />
        <p className="text-xs text-text-secondary leading-relaxed">
          Si vous n&apos;avez pas de crédit (achat comptant), passez cette étape.
        </p>
      </div>

      <Field
        label="Montant emprunté"
        type="number"
        placeholder="160 000"
        suffix="€"
        value={data.loan_amount}
        onChange={(e) => update("loan_amount", e.target.value)}
        disabled={!data.has_loan}
      />

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Taux annuel"
          type="number"
          placeholder="3.5"
          suffix="%"
          value={data.loan_rate}
          onChange={(e) => update("loan_rate", e.target.value)}
          step="0.01"
          disabled={!data.has_loan}
        />
        <Field
          label="Durée"
          type="number"
          placeholder="20"
          suffix="ans"
          value={data.loan_duration}
          onChange={(e) => update("loan_duration", e.target.value)}
          min="1"
          disabled={!data.has_loan}
        />
      </div>

      {/* Date de début — nouveau champ */}
      <div className={`space-y-1.5 ${!data.has_loan ? "opacity-40" : ""}`}>
        <label className="block text-xs font-medium text-text-secondary">
          Date de début du crédit
        </label>
        <input
          type="month"
          value={data.loan_start_date}
          onChange={(e) => update("loan_start_date", e.target.value)}
          disabled={!data.has_loan}
          max={new Date().toISOString().slice(0, 7)}
          className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm text-text focus:outline-none focus:border-accent transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        />
        <p className="text-[11px] text-text-secondary">
          Permet de calculer le capital restant dû exact.
        </p>
      </div>

      {/* Live preview */}
      {monthly !== null && data.has_loan && (
        <div className="bg-bg rounded-xl p-4 border border-border space-y-3">
          {/* Mensualité */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-text-secondary">Mensualité</p>
            <p className="font-mono font-bold text-lg text-text">
              {fmt(monthly)} <span className="text-text-secondary text-sm font-normal">€/mois</span>
            </p>
          </div>

          {/* Jauge de remboursement dynamique */}
          {repayment ? (
            <>
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-secondary">Capital remboursé</span>
                <span className="font-mono font-semibold text-green">
                  {fmt(amount - repayment.remaining)} €
                  <span className="text-text-secondary font-normal"> / {fmt(amount)} €</span>
                </span>
              </div>
              <div className="space-y-1">
                <div className="h-2.5 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${repayment.pct}%`,
                      background: "linear-gradient(to right, #6C63FF, #00D9A6)",
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-text-secondary">
                  <span>{repayment.pct.toFixed(1)} % remboursé</span>
                  <span>Capital restant : <span className="font-mono font-semibold text-text">{fmt(repayment.remaining)} €</span></span>
                </div>
              </div>
              <p className="text-[10px] text-text-secondary">
                {repayment.monthsElapsed} mois écoulés sur {duration * 12}
              </p>
            </>
          ) : amount > 0 && rate > 0 && duration > 0 ? (
            <p className="text-[11px] text-text-secondary italic">
              Renseignez la date de début pour voir le capital restant.
            </p>
          ) : null}
        </div>
      )}

      {/* No loan toggle */}
      <button
        type="button"
        onClick={() => setHasLoan(!data.has_loan)}
        className={`w-full py-3 rounded-xl border text-sm font-medium transition-colors ${
          !data.has_loan
            ? "border-accent bg-accent/15 text-accent"
            : "border-border text-text-secondary hover:border-accent/40 hover:text-text"
        }`}
      >
        {data.has_loan ? "Pas de crédit (achat comptant)" : "✓ Achat comptant sélectionné"}
      </button>
    </div>
  );
}

// ── Step 3 — Les revenus ──────────────────────────────────────

function Step3({
  data,
  update,
}: {
  data: FormData;
  update: (field: keyof FormData, value: string) => void;
}) {
  const monthlyRent = parseFloat(data.monthly_rent) || 0;
  const purchasePrice = parseFloat(data.purchase_price) || 0;
  const annualRevenue = monthlyRent * 12;
  const rendementBrut =
    purchasePrice > 0 ? (annualRevenue / purchasePrice) * 100 : null;

  return (
    <div className="space-y-4">
      <Field
        label="Loyer mensuel charges comprises"
        type="number"
        placeholder="850"
        suffix="€/mois"
        value={data.monthly_rent}
        onChange={(e) => update("monthly_rent", e.target.value)}
        required
        min="1"
      />

      {/* Régime fiscal */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-text-secondary">
          Régime fiscal
        </p>
        <div className="flex flex-wrap gap-2">
          {REGIMES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => update("regime", data.regime === r ? "" : r)}
              className={`text-[11px] px-2.5 py-1.5 rounded-lg border transition-colors font-medium ${
                data.regime === r
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-border text-text-secondary hover:border-accent/40 hover:text-text"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Live preview */}
      {monthlyRent > 0 && (
        <div className="bg-bg rounded-xl p-4 border border-border space-y-2.5">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
            Aperçu rapide
          </p>
          <div className="flex justify-between items-center">
            <span className="text-sm text-text-secondary">Revenus annuels</span>
            <span className="font-mono font-semibold text-text">
              {fmt(annualRevenue)} €
            </span>
          </div>
          {rendementBrut !== null && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-text-secondary">
                Rendement brut
              </span>
              <span className="font-mono font-semibold text-accent">
                {rendementBrut.toFixed(1)} %
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Step 4 — Les charges ──────────────────────────────────────

function Step4({
  data,
  update,
}: {
  data: FormData;
  update: (field: keyof FormData, value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex gap-3 p-4 bg-[#FBBF24]/5 border border-[#FBBF24]/20 rounded-xl">
        <AlertTriangle size={16} className="text-[#FBBF24] shrink-0 mt-0.5" />
        <p className="text-xs text-text-secondary leading-relaxed">
          Ces montants sont{" "}
          <strong className="text-text">annuels</strong>. Laissez vide si vous
          ne connaissez pas — on estimera pour vous.
        </p>
      </div>

      <Field
        label="Taxe foncière"
        type="number"
        placeholder="700"
        suffix="€/an"
        value={data.taxe_fonciere}
        onChange={(e) => update("taxe_fonciere", e.target.value)}
      />
      <Field
        label="Charges de copropriété"
        type="number"
        placeholder="540"
        suffix="€/an"
        value={data.copro}
        onChange={(e) => update("copro", e.target.value)}
      />
      <Field
        label="Assurance PNO"
        type="number"
        placeholder="150"
        suffix="€/an"
        value={data.pno}
        onChange={(e) => update("pno", e.target.value)}
      />
      <Field
        label="Assurance GLI"
        type="number"
        placeholder="230"
        suffix="€/an"
        value={data.gli}
        onChange={(e) => update("gli", e.target.value)}
      />
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────

export default function NouveauBienPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<FormData>(INITIAL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function update(field: keyof FormData, value: string) {
    setData((d) => ({ ...d, [field]: value }));
    setError("");
  }

  function setHasLoan(v: boolean) {
    setData((d) => ({ ...d, has_loan: v }));
  }

  function prev() {
    if (step > 0) {
      setError("");
      setStep(step - 1);
    } else {
      router.back();
    }
  }

  function next() {
    if (step === 0) {
      if (!data.name.trim()) {
        setError("Le nom du bien est requis.");
        return;
      }
      if (!data.purchase_price) {
        setError("Le prix d'achat est requis.");
        return;
      }
    }
    if (step === 2 && !data.monthly_rent) {
      setError("Le loyer mensuel est requis.");
      return;
    }
    setError("");
    setStep(step + 1);
  }

  async function submit() {
    setError("");
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Session expirée. Veuillez vous reconnecter.");
      setLoading(false);
      return;
    }

    const purchasePrice = parseFloat(data.purchase_price) || 0;
    const currentValue =
      parseFloat(data.current_value) || purchasePrice;
    const monthlyRent = parseFloat(data.monthly_rent) || 0;

    // Estimates for empty charge fields
    const taxeFonciereAmt =
      parseFloat(data.taxe_fonciere) || Math.round(purchasePrice * 0.008);
    const coproAmt = parseFloat(data.copro) || 600;
    const pnoAmt = parseFloat(data.pno) || 144;
    const gliAmt =
      parseFloat(data.gli) || Math.round(monthlyRent * 12 * 0.025);

    // 1. Insert property
    const { data: prop, error: propErr } = await supabase
      .from("properties")
      .insert({
        user_id: user.id,
        name: data.name.trim(),
        address: [
          data.address_number.trim(),
          data.address_street.trim(),
          data.address_postal.trim(),
          data.address_city.trim(),
        ].filter(Boolean).join(" ") || null,
        type: data.type || "appartement",
        surface: parseFloat(data.surface) || null,
        purchase_price: purchasePrice,
        purchase_date: data.purchase_date.trim() ? parseFrenchDate(data.purchase_date) : null,
        current_value: currentValue,
        regime: data.regime || null,
        dpe: data.dpe || null,
      })
      .select("id")
      .single();

    if (propErr || !prop) {
      console.error("Supabase insert error:", propErr);
      setError(`Erreur : ${propErr?.message ?? "inconnue"} (code : ${propErr?.code ?? "?"})`);
      setLoading(false);
      return;
    }

    const propertyId = prop.id;

    // 2. Insert loan if applicable
    if (data.has_loan && data.loan_amount) {
      const loanAmount = parseFloat(data.loan_amount) || 0;
      const loanRate = parseFloat(data.loan_rate) || 0;
      const loanDuration = parseFloat(data.loan_duration) || 0;
      const monthlyPayment = computeMonthlyPayment(loanAmount, loanRate, loanDuration);

      // Compute actual remaining capital from start date
      const startDateStr = data.loan_start_date
        ? `${data.loan_start_date}-01`
        : null;
      let remainingCapital = loanAmount;
      if (data.loan_start_date && loanRate > 0 && loanDuration > 0) {
        const repayment = computeRemainingFromDate(loanAmount, loanRate, loanDuration, data.loan_start_date);
        if (repayment) remainingCapital = repayment.remaining;
      }

      await supabase.from("loans").insert({
        property_id: propertyId,
        amount: loanAmount,
        rate: loanRate,
        duration_years: loanDuration,
        monthly_payment: Math.round(monthlyPayment),
        start_date: startDateStr,
        remaining_capital: Math.round(remainingCapital),
      });
    }

    // 3. Insert charges
    await supabase.from("charges").insert([
      {
        property_id: propertyId,
        type: "taxe_fonciere",
        amount: taxeFonciereAmt,
        frequency: "yearly",
      },
      {
        property_id: propertyId,
        type: "copro",
        amount: coproAmt,
        frequency: "yearly",
      },
      {
        property_id: propertyId,
        type: "pno",
        amount: pnoAmt,
        frequency: "yearly",
      },
      {
        property_id: propertyId,
        type: "gli",
        amount: gliAmt,
        frequency: "yearly",
      },
    ]);

    // 4. Insert revenues
    await supabase.from("revenues").insert({
      property_id: propertyId,
      monthly_rent: monthlyRent,
      vacancy_rate: 5,
    });

    setLoading(false);
    router.push(`/biens/${propertyId}`);
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Custom header */}
      <div className="flex items-center justify-between px-4 py-3.5 bg-card border-b border-border sticky top-0 z-10">
        <button
          type="button"
          onClick={prev}
          className="w-9 h-9 rounded-xl bg-bg border border-border flex items-center justify-center text-text-secondary hover:text-text transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-text leading-tight">
            {STEP_TITLES[step]}
          </p>
          <p className="text-[11px] text-text-secondary">
            Étape {step + 1} / 4
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/biens")}
          className="w-9 h-9 rounded-xl bg-bg border border-border flex items-center justify-center text-text-secondary hover:text-text transition-colors"
          aria-label="Annuler"
        >
          <X size={16} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="flex gap-1 px-4 pt-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              i <= step ? "bg-accent" : "bg-border"
            }`}
          />
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-32">
        {error && (
          <div className="mb-4 px-4 py-3 bg-red/10 border border-red/20 rounded-xl text-red text-sm">
            {error}
          </div>
        )}

        {step === 0 && <Step1 data={data} update={update} />}
        {step === 1 && (
          <Step2 data={data} update={update} setHasLoan={setHasLoan} />
        )}
        {step === 2 && <Step3 data={data} update={update} />}
        {step === 3 && <Step4 data={data} update={update} />}
      </div>

      {/* Footer nav */}
      <div className="fixed bottom-0 inset-x-0 p-4 bg-bg border-t border-border">
        {step === 3 ? (
          <button
            type="button"
            onClick={submit}
            disabled={loading}
            className="w-full py-3.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98] transition-all"
            style={{
              background: "linear-gradient(135deg, #6C63FF 0%, #00D9A6 100%)",
            }}
          >
            {loading ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Check size={15} />
            )}
            Calculer mon cashflow
          </button>
        ) : (
          <button
            type="button"
            onClick={next}
            className="w-full py-3.5 bg-accent text-white rounded-xl text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all"
          >
            Suivant
          </button>
        )}
      </div>
    </div>
  );
}
