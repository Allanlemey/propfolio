"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
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
      <div className="relative min-h-screen bg-bg overflow-x-hidden flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="relative min-h-screen bg-bg overflow-x-hidden">
      {/* Decorative background */}
      <div className="absolute top-0 inset-x-0 h-[400px] bg-gradient-to-b from-accent/5 to-transparent pointer-events-none" />
      <div className="absolute top-20 right-[-10%] w-[40%] h-[20%] bg-accent/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-40 left-[-10%] w-[30%] h-[15%] bg-green/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative px-4 pt-8 pb-24 max-w-2xl mx-auto space-y-6">

        {/* ── Header ──────────────────────────────────────── */}
        <div className="flex items-end justify-between px-1">
          <div className="space-y-1">
            <h1 className="text-2xl font-black tracking-tight leading-none bg-gradient-to-r from-text to-text-secondary bg-clip-text text-transparent">
              Mon Profil
            </h1>
            <div className="text-text-muted text-xs font-bold uppercase tracking-widest flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              Paramètres &amp; Compte
            </div>
          </div>
          {/* Avatar compact */}
          <Avatar name={profile.name} email={profile.email} />
        </div>

        {/* ── Identity card ──────────────────────────────── */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="flex items-center gap-4 px-4 py-4 border-b border-border">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-text-secondary font-bold uppercase tracking-widest mb-1">Nom affiché</p>
              {editingName ? (
                <input
                  ref={nameInputRef}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={handleNameBlur}
                  onKeyDown={(e) => { if (e.key === "Enter") nameInputRef.current?.blur(); }}
                  className="w-full text-base font-semibold bg-bg border border-accent rounded-lg px-2 py-1 text-text outline-none"
                  autoFocus
                  placeholder="Votre prénom"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingName(true)}
                  className="text-base font-bold text-text text-left hover:text-accent transition-colors flex items-center gap-2"
                >
                  {name || "Ajouter un prénom"}
                  <span className="text-[10px] text-text-secondary font-normal border border-border rounded-md px-1.5 py-0.5">
                    Modifier
                  </span>
                </button>
              )}
              <p className="text-xs text-text-secondary mt-1 truncate">{profile.email}</p>
            </div>
          </div>
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
        </div>

        {/* ── Profil fiscal ──────────────────────────────── */}
        <div className="space-y-2">
          <h2 className="text-xs font-bold text-text-secondary uppercase tracking-widest px-1 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
            Profil fiscal
          </h2>
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="px-4 py-4 border-b border-border">
              <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">Régime fiscal principal</p>
              <div className="grid grid-cols-2 gap-2">
                {REGIMES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => handleRegimeChange(r)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all active:scale-[0.97] ${
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

            <div className="px-4 py-4 border-b border-border">
              <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">Tranche marginale d&apos;imposition (TMI)</p>
              <div className="flex gap-2">
                {TMI_OPTIONS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleTmiChange(t)}
                    className={`flex-1 py-2 rounded-xl text-xs font-mono font-bold border transition-all active:scale-[0.97] ${
                      tmi === t
                        ? "bg-accent/15 border-accent text-accent"
                        : "bg-bg border-border text-text-secondary hover:border-accent/40 hover:text-text"
                    }`}
                  >
                    {t}%
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 px-4 py-3.5">
              <Info size={14} className="text-accent shrink-0 mt-0.5" />
              <p className="text-xs text-text-secondary leading-relaxed">
                Votre TMI est utilisée pour estimer l&apos;impôt sur vos revenus locatifs dans tous les calculs de cashflow net.
              </p>
            </div>
          </div>
        </div>

        {/* ── Notifications ──────────────────────────────── */}
        <div className="space-y-2">
          <h2 className="text-xs font-bold text-text-secondary uppercase tracking-widest px-1 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
            Notifications
          </h2>
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <Toggle label="Rappel loyer" description="Alerte si le loyer n'est pas encaissé" checked={notifLoyer} onChange={setNotifLoyer} disabled />
            <Toggle label="Rappel échéances" description="TF, assurance, renouvellement de bail" checked={notifEcheances} onChange={setNotifEcheances} disabled />
            <Toggle label="Alerte cashflow négatif" description="Notification si votre cashflow passe en négatif" checked={notifCashflow} onChange={setNotifCashflow} disabled />
            <div className="flex gap-3 px-4 py-3.5 border-t border-border">
              <Bell size={14} className="text-text-secondary shrink-0 mt-0.5" />
              <p className="text-xs text-text-secondary leading-relaxed">Les notifications seront disponibles prochainement.</p>
            </div>
          </div>
        </div>

        {/* ── Abonnement ─────────────────────────────────── */}
        <div className="space-y-2">
          <h2 className="text-xs font-bold text-text-secondary uppercase tracking-widest px-1 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
            Abonnement
          </h2>

          {/* Current plan badge */}
          <div className="bg-card rounded-2xl border border-border px-4 py-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-text">Plan Gratuit</p>
              <p className="text-xs text-text-secondary mt-0.5">1 bien · Cashflow brut uniquement</p>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-border/60 text-text-secondary border border-border">
              Actif
            </span>
          </div>

          {/* Premium CTA card */}
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div
              className="px-4 py-5"
              style={{ background: "linear-gradient(135deg, rgba(108,99,255,0.12) 0%, rgba(0,217,166,0.08) 100%)" }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={16} className="text-accent" strokeWidth={2} />
                <p className="text-sm font-black text-text">Propfolio Premium</p>
              </div>
              <div className="space-y-2 mb-4">
                {PREMIUM_FEATURES.map((f) => (
                  <div key={f} className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                      <Check size={9} strokeWidth={3} className="text-accent" />
                    </div>
                    <span className="text-xs text-text">{f}</span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={handlePremiumCta}
                className="w-full py-3.5 rounded-2xl text-sm font-black text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-lg"
                style={{ background: "linear-gradient(135deg, #6C63FF 0%, #00D9A6 100%)" }}
              >
                <Sparkles size={15} strokeWidth={2} />
                Passer à Premium — 9 €/mois
              </button>
              <p className="text-[11px] text-text-secondary text-center mt-2">ou 79 €/an · 2 mois offerts</p>
            </div>
          </div>
        </div>

        {/* ── À propos ───────────────────────────────────── */}
        <div className="space-y-2">
          <h2 className="text-xs font-bold text-text-secondary uppercase tracking-widest px-1 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
            À propos
          </h2>
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="px-4 py-4 border-b border-border flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-text">Propfolio</p>
                <p className="text-xs text-text-secondary mt-0.5">Fait par un investisseur LMNP, pour les investisseurs LMNP.</p>
              </div>
              <span className="font-mono text-[11px] text-text-secondary border border-border rounded-lg px-2 py-1">v1.0</span>
            </div>
            <Link href="/cgu" className="flex items-center justify-between px-4 py-3.5 border-b border-border hover:bg-bg/50 transition-colors">
              <div className="flex items-center gap-3 text-text-secondary">
                <FileText size={15} strokeWidth={1.8} />
                <span className="text-sm">Conditions générales d&apos;utilisation</span>
              </div>
              <ChevronRight size={14} className="text-text-secondary" />
            </Link>
            <Link href="/confidentialite" className="flex items-center justify-between px-4 py-3.5 border-b border-border hover:bg-bg/50 transition-colors">
              <div className="flex items-center gap-3 text-text-secondary">
                <Shield size={15} strokeWidth={1.8} />
                <span className="text-sm">Politique de confidentialité</span>
              </div>
              <ChevronRight size={14} className="text-text-secondary" />
            </Link>
            <Link href="/contact" className="flex items-center justify-between px-4 py-3.5 hover:bg-bg/50 transition-colors">
              <div className="flex items-center gap-3 text-text-secondary">
                <Mail size={15} strokeWidth={1.8} />
                <span className="text-sm">Contact</span>
              </div>
              <ChevronRight size={14} className="text-text-secondary" />
            </Link>
          </div>
        </div>

        <p className="text-[11px] text-text-secondary text-center pb-2">
          Calculs fiscaux indicatifs. Consultez un expert-comptable.
        </p>
      </div>

      {/* Toast */}
      <Toast visible={toast.visible} message={toast.message} type={toast.type} />
    </div>
  );
}
