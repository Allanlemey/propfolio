"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  LogOut,
  Check,
  ChevronRight,
  Sparkles,
  Bell,
  Info,
  FileText,
  Shield,
  Mail,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

// ── Types ─────────────────────────────────────────────────────

type UserProfile = {
  id: string;
  name: string | null;
  email: string;
  tax_regime: string | null;
  tax_bracket: number | null;
};

// ── Constants ─────────────────────────────────────────────────

const REGIMES = [
  "LMNP micro-BIC",
  "LMNP réel",
  "Nu micro-foncier",
  "Nu réel",
] as const;

const TMI_OPTIONS = [0, 11, 30, 41, 45] as const;

const PREMIUM_FEATURES = [
  "Biens illimités",
  "Cashflow NET (fiscalité réelle)",
  "Projections sur 10 ans",
  "Score investissement /100",
  "Export image & rapport PDF",
  "Simulations illimitées",
];

// ── Toast ─────────────────────────────────────────────────────

function Toast({
  visible,
  message,
  type = "success",
}: {
  visible: boolean;
  message: string;
  type?: "success" | "info";
}) {
  return (
    <div
      className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg border transition-all duration-300 ${
        visible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-2 pointer-events-none"
      } ${
        type === "success"
          ? "bg-green/10 border-green/30 text-green"
          : "bg-accent/10 border-accent/30 text-accent"
      }`}
    >
      {type === "success" ? (
        <Check size={14} strokeWidth={2.5} />
      ) : (
        <Sparkles size={14} strokeWidth={2} />
      )}
      {message}
    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider px-1">
        {title}
      </h2>
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {children}
      </div>
    </div>
  );
}

// ── Toggle ────────────────────────────────────────────────────

function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between px-4 py-3.5 border-b border-border last:border-0 ${
        disabled ? "opacity-50" : ""
      }`}
    >
      <div className="flex-1 min-w-0 pr-3">
        <p className="text-sm font-medium text-text">{label}</p>
        {description && (
          <p className="text-[11px] text-text-secondary mt-0.5">{description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ${
          checked ? "bg-accent" : "bg-border"
        }`}
        aria-label={label}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

// ── Avatar ────────────────────────────────────────────────────

function Avatar({ name, email }: { name: string | null; email: string }) {
  const initial = (name || email || "P").charAt(0).toUpperCase();
  return (
    <div
      className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-mono font-bold text-2xl shrink-0"
      style={{ background: "linear-gradient(135deg, #6C63FF 0%, #00D9A6 100%)" }}
    >
      {initial}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────

export default function ProfilPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [regime, setRegime] = useState<string>("LMNP micro-BIC");
  const [tmi, setTmi] = useState<number>(30);

  // Notifications (local state for MVP)
  const [notifLoyer, setNotifLoyer] = useState(false);
  const [notifEcheances, setNotifEcheances] = useState(false);
  const [notifCashflow, setNotifCashflow] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: "success" | "info" }>({
    visible: false,
    message: "",
    type: "success",
  });

  const nameInputRef = useRef<HTMLInputElement>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load ──────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth");
        return;
      }

      const { data: userData } = await supabase
        .from("users")
        .select("id, name, tax_regime, tax_bracket")
        .eq("id", user.id)
        .maybeSingle();

      const profile: UserProfile = {
        id: user.id,
        name: userData?.name ?? null,
        email: user.email ?? "",
        tax_regime: userData?.tax_regime ?? "LMNP micro-BIC",
        tax_bracket: userData?.tax_bracket ?? 30,
      };

      setProfile(profile);
      setName(profile.name ?? "");
      setRegime(profile.tax_regime ?? "LMNP micro-BIC");
      setTmi(profile.tax_bracket ?? 30);
      setLoading(false);
    }

    load();
  }, [router]);

  // ── Auto-save (debounced 500ms) ────────────────────────────

  const showToast = useCallback((message: string, type: "success" | "info" = "success") => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 2500);
  }, []);

  const scheduleSave = useCallback(
    (updates: { name?: string; tax_regime?: string; tax_bracket?: number }) => {
      if (!profile) return;
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(async () => {
        const { error } = await supabase
          .from("users")
          .upsert(
            { id: profile.id, email: profile.email, ...updates },
            { onConflict: "id" }
          );
        if (!error) showToast("Modifications sauvegardées");
      }, 500);
    },
    [profile, showToast]
  );

  // ── Handlers ─────────────────────────────────────────────

  function handleNameBlur() {
    setEditingName(false);
    scheduleSave({ name });
  }

  function handleRegimeChange(r: string) {
    setRegime(r);
    scheduleSave({ tax_regime: r });
  }

  function handleTmiChange(t: number) {
    setTmi(t);
    scheduleSave({ tax_bracket: t });
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/auth");
  }

  function handlePremiumCta() {
    showToast("Bientôt disponible ✨", "info");
  }

  // ── Loading ───────────────────────────────────────────────

  if (loading || !profile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="px-4 pt-5 pb-8 max-w-2xl mx-auto space-y-5">
      <h1 className="text-xl font-bold text-text">Profil</h1>

      {/* ── Section 1 — Mon compte ────────────────────────── */}
      <Section title="Mon compte">
        {/* Avatar + identity */}
        <div className="flex items-center gap-4 px-4 py-4 border-b border-border">
          <Avatar name={profile.name} email={profile.email} />
          <div className="flex-1 min-w-0">
            {editingName ? (
              <input
                ref={nameInputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={handleNameBlur}
                onKeyDown={(e) => {
                  if (e.key === "Enter") nameInputRef.current?.blur();
                }}
                className="w-full text-sm font-semibold bg-bg border border-accent rounded-lg px-2 py-1 text-text outline-none"
                autoFocus
                placeholder="Votre prénom"
              />
            ) : (
              <button
                type="button"
                onClick={() => setEditingName(true)}
                className="text-sm font-semibold text-text text-left hover:text-accent transition-colors"
              >
                {name || "Ajouter un prénom"}
                <span className="ml-1.5 text-[10px] text-text-secondary font-normal">
                  Modifier
                </span>
              </button>
            )}
            <p className="text-xs text-text-secondary mt-0.5 truncate">
              {profile.email}
            </p>
          </div>
        </div>

        {/* Sign out */}
        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center justify-between w-full px-4 py-3.5 text-red hover:bg-red/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <LogOut size={16} strokeWidth={1.8} />
            <span className="text-sm font-medium">Se déconnecter</span>
          </div>
          <ChevronRight size={14} className="text-text-secondary" />
        </button>
      </Section>

      {/* ── Section 2 — Profil fiscal ─────────────────────── */}
      <Section title="Mon profil fiscal">
        {/* Regime selector */}
        <div className="px-4 py-4 border-b border-border">
          <p className="text-sm font-medium text-text mb-3">
            Régime fiscal principal
          </p>
          <div className="grid grid-cols-2 gap-2">
            {REGIMES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => handleRegimeChange(r)}
                className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all ${
                  regime === r
                    ? "bg-accent/15 border-accent text-accent"
                    : "bg-bg border-border text-text-secondary hover:border-accent/40 hover:text-text"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* TMI selector */}
        <div className="px-4 py-4 border-b border-border">
          <p className="text-sm font-medium text-text mb-3">
            Tranche marginale d&apos;imposition (TMI)
          </p>
          <div className="flex gap-2">
            {TMI_OPTIONS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handleTmiChange(t)}
                className={`flex-1 py-2 rounded-xl text-xs font-mono font-bold border transition-all ${
                  tmi === t
                    ? "bg-accent/15 border-accent text-accent"
                    : "bg-bg border-border text-text-secondary hover:border-accent/40 hover:text-text"
                }`}
              >
                {t} %
              </button>
            ))}
          </div>
        </div>

        {/* Info encart */}
        <div className="flex gap-3 px-4 py-3.5">
          <Info size={14} className="text-accent shrink-0 mt-0.5" />
          <p className="text-xs text-text-secondary leading-relaxed">
            Votre TMI est utilisée pour estimer l&apos;impôt sur vos revenus
            locatifs dans tous les calculs de cashflow net.
          </p>
        </div>
      </Section>

      {/* ── Section 3 — Notifications ─────────────────────── */}
      <Section title="Notifications">
        <Toggle
          label="Rappel loyer"
          description="Alerte si le loyer n'est pas encaissé"
          checked={notifLoyer}
          onChange={setNotifLoyer}
          disabled
        />
        <Toggle
          label="Rappel échéances"
          description="TF, assurance, renouvellement de bail"
          checked={notifEcheances}
          onChange={setNotifEcheances}
          disabled
        />
        <Toggle
          label="Alerte cashflow négatif"
          description="Notification si votre cashflow passe en négatif"
          checked={notifCashflow}
          onChange={setNotifCashflow}
          disabled
        />

        {/* MVP notice */}
        <div className="flex gap-3 px-4 py-3.5 border-t border-border">
          <Bell size={14} className="text-text-secondary shrink-0 mt-0.5" />
          <p className="text-xs text-text-secondary leading-relaxed">
            Les notifications seront disponibles prochainement.
          </p>
        </div>
      </Section>

      {/* ── Section 4 — Abonnement ────────────────────────── */}
      <Section title="Mon abonnement">
        {/* Current plan */}
        <div className="px-4 py-4 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm font-semibold text-text">Plan Gratuit</p>
              <p className="text-xs text-text-secondary mt-0.5">
                1 bien · Cashflow brut uniquement
              </p>
            </div>
            <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-border text-text-secondary border border-border">
              Actif
            </span>
          </div>
        </div>

        {/* Premium CTA */}
        <div className="px-4 py-4 border-b border-border">
          <button
            type="button"
            onClick={handlePremiumCta}
            className="w-full py-3.5 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            style={{
              background: "linear-gradient(135deg, #6C63FF 0%, #00D9A6 100%)",
            }}
          >
            <Sparkles size={16} strokeWidth={2} />
            Passer à Premium — 9 €/mois
          </button>
          <p className="text-[11px] text-text-secondary text-center mt-2">
            ou 79 €/an (2 mois offerts)
          </p>
        </div>

        {/* Premium features list */}
        <div className="px-4 py-3">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
            Inclus dans Premium
          </p>
          <div className="space-y-2.5">
            {PREMIUM_FEATURES.map((f) => (
              <div key={f} className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
                  <Check size={9} strokeWidth={3} className="text-accent" />
                </div>
                <span className="text-sm text-text">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── Section 5 — À propos ──────────────────────────── */}
      <Section title="À propos">
        <div className="px-4 py-4 border-b border-border">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-medium text-text">Propfolio</p>
            <span className="font-mono text-[11px] text-text-secondary">
              MVP 1.0
            </span>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">
            Fait par un investisseur LMNP, pour les investisseurs LMNP.
          </p>
        </div>

        <a
          href="#"
          className="flex items-center justify-between px-4 py-3.5 border-b border-border hover:bg-bg/50 transition-colors"
        >
          <div className="flex items-center gap-3 text-text-secondary">
            <FileText size={15} strokeWidth={1.8} />
            <span className="text-sm">Conditions générales d&apos;utilisation</span>
          </div>
          <ChevronRight size={14} className="text-text-secondary" />
        </a>

        <a
          href="#"
          className="flex items-center justify-between px-4 py-3.5 border-b border-border hover:bg-bg/50 transition-colors"
        >
          <div className="flex items-center gap-3 text-text-secondary">
            <Shield size={15} strokeWidth={1.8} />
            <span className="text-sm">Politique de confidentialité</span>
          </div>
          <ChevronRight size={14} className="text-text-secondary" />
        </a>

        <a
          href="mailto:contact@propfolio.fr"
          className="flex items-center justify-between px-4 py-3.5 hover:bg-bg/50 transition-colors"
        >
          <div className="flex items-center gap-3 text-text-secondary">
            <Mail size={15} strokeWidth={1.8} />
            <span className="text-sm">Contact</span>
          </div>
          <ChevronRight size={14} className="text-text-secondary" />
        </a>
      </Section>

      <p className="text-[11px] text-text-secondary text-center pb-2">
        Calculs fiscaux indicatifs. Consultez un expert-comptable.
      </p>

      {/* Toast */}
      <Toast visible={toast.visible} message={toast.message} type={toast.type} />
    </div>
  );
}
