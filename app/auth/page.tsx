"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, CheckCircle2, Circle } from "lucide-react";
import { supabase } from "@/lib/supabase";

// ── Types ─────────────────────────────────────────────────────

type Tab = "login" | "register";

const REGIMES = [
  "LMNP micro-BIC",
  "LMNP réel",
  "Nu micro-foncier",
  "Nu réel",
  "Je ne sais pas",
] as const;

type Regime = (typeof REGIMES)[number];

// ── Password strength ─────────────────────────────────────────

function getChecks(pw: string) {
  return {
    length: pw.length >= 8,
    uppercase: /[A-Z]/.test(pw),
    digit: /[0-9]/.test(pw),
  };
}

const CRITERIA = [
  { key: "length" as const, label: "8 caractères minimum" },
  { key: "uppercase" as const, label: "1 majuscule" },
  { key: "digit" as const, label: "1 chiffre" },
];

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const checks = getChecks(password);
  const score = Object.values(checks).filter(Boolean).length;
  const barColor =
    score === 3 ? "bg-green" : score === 2 ? "bg-[#F59E0B]" : "bg-red";

  return (
    <div className="space-y-2 pt-1">
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              i < score ? barColor : "bg-border"
            }`}
          />
        ))}
      </div>
      <div className="space-y-1">
        {CRITERIA.map(({ key, label }) => {
          const ok = checks[key];
          return (
            <div key={key} className="flex items-center gap-1.5">
              {ok ? (
                <CheckCircle2 size={11} className="text-green shrink-0" />
              ) : (
                <Circle size={11} className="text-text-secondary shrink-0" />
              )}
              <span
                className={`text-[11px] ${
                  ok ? "text-green" : "text-text-secondary"
                }`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Google logo SVG ───────────────────────────────────────────

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden>
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

// ── Input ─────────────────────────────────────────────────────

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  suffix?: React.ReactNode;
}

function Field({ label, suffix, ...props }: InputProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-text-secondary">
        {label}
      </label>
      <div className="relative">
        <input
          {...props}
          className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm text-text placeholder:text-text-secondary focus:outline-none focus:border-accent transition-colors"
        />
        {suffix && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {suffix}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────

export default function AuthPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("login");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPw, setLoginPw] = useState("");

  // Register state
  const [name, setName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPw, setRegPw] = useState("");
  const [regime, setRegime] = useState<Regime | "">("");

  async function handleGoogle() {
    setGoogleLoading(true);
    setError("");
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    // Browser will redirect — no need to setGoogleLoading(false)
  }

  function switchTab(t: Tab) {
    setTab(t);
    setError("");
    setShowPw(false);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPw,
    });

    if (error) {
      setError(
        error.message === "Invalid login credentials"
          ? "Email ou mot de passe incorrect."
          : "Une erreur est survenue. Réessayez."
      );
    } else {
      router.push("/dashboard");
      router.refresh();
    }

    setLoading(false);
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const checks = getChecks(regPw);
    if (!checks.length || !checks.uppercase || !checks.digit) {
      setError("Le mot de passe ne remplit pas tous les critères requis.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: regEmail,
      password: regPw,
    });

    if (error) {
      setError(
        error.message.includes("already registered")
          ? "Cet email est déjà utilisé."
          : "Une erreur est survenue. Réessayez."
      );
      setLoading(false);
      return;
    }

    if (data.user) {
      // Insert user profile — requires email confirmation disabled in Supabase dashboard
      await supabase.from("users").insert({
        id: data.user.id,
        email: regEmail,
        name: name.trim() || null,
        tax_regime: regime || null,
      });

      router.push("/onboarding");
      router.refresh();
    }

    setLoading(false);
  }

  const eyeBtn = (
    <button
      type="button"
      onClick={() => setShowPw((v) => !v)}
      aria-label={showPw ? "Masquer" : "Afficher"}
      className="text-text-secondary hover:text-text transition-colors p-1 -mr-1"
    >
      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  );

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="mb-8">
        <span className="font-mono font-bold text-2xl tracking-tight select-none">
          <span style={{ color: "var(--accent)" }}>Prop</span>
          <span className="text-text">folio</span>
        </span>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-2xl shadow-black/30">
        {/* Segmented control */}
        <div className="relative flex bg-bg rounded-xl p-1 border border-border mb-6">
          <div
            className={`absolute top-1 bottom-1 rounded-lg bg-card border border-border shadow-sm transition-all duration-200 ease-in-out ${
              tab === "login" ? "left-1 right-[50%]" : "left-[50%] right-1"
            }`}
          />
          {(["login", "register"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`relative z-10 flex-1 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                tab === t ? "text-text" : "text-text-secondary"
              }`}
              onClick={() => switchTab(t)}
            >
              {t === "login" ? "Connexion" : "Inscription"}
            </button>
          ))}
        </div>

        {/* Google */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-border text-sm font-medium text-text hover:bg-card transition-colors mb-5 disabled:opacity-60"
        >
          {googleLoading ? (
            <Loader2 size={18} className="animate-spin shrink-0" />
          ) : (
            <GoogleLogo />
          )}
          Continuer avec Google
        </button>

        {/* Separator */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-border" />
          <span className="text-text-secondary text-xs">ou par email</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 px-4 py-3 bg-red/10 border border-red/20 rounded-xl text-red text-sm">
            {error}
          </div>
        )}

        {/* ── Login form ────────────────────────────────────── */}
        {tab === "login" && (
          <form onSubmit={handleLogin} className="space-y-4">
            <Field
              label="Adresse email"
              type="email"
              placeholder="vous@exemple.com"
              required
              autoComplete="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
            />
            <div>
              <Field
                label="Mot de passe"
                type={showPw ? "text" : "password"}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                value={loginPw}
                onChange={(e) => setLoginPw(e.target.value)}
                suffix={eyeBtn}
              />
              <div className="text-right mt-1.5">
                <button
                  type="button"
                  className="text-xs text-accent hover:underline"
                >
                  Mot de passe oublié ?
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-1 py-3 bg-accent text-white rounded-xl text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              Se connecter
            </button>
          </form>
        )}

        {/* ── Register form ─────────────────────────────────── */}
        {tab === "register" && (
          <form onSubmit={handleRegister} className="space-y-4">
            <Field
              label="Prénom"
              type="text"
              placeholder="Votre prénom"
              autoComplete="given-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Field
              label="Adresse email"
              type="email"
              placeholder="vous@exemple.com"
              required
              autoComplete="email"
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
            />
            <div className="space-y-1.5">
              <Field
                label="Mot de passe"
                type={showPw ? "text" : "password"}
                placeholder="••••••••"
                required
                autoComplete="new-password"
                value={regPw}
                onChange={(e) => setRegPw(e.target.value)}
                suffix={eyeBtn}
              />
              <PasswordStrength password={regPw} />
            </div>

            {/* Régime fiscal */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-text-secondary">
                Régime fiscal{" "}
                <span className="font-normal opacity-70">(optionnel)</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {REGIMES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRegime(regime === r ? "" : r)}
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

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-1 py-3 bg-accent text-white rounded-xl text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              Créer mon compte gratuit
            </button>
          </form>
        )}

        {/* Switch tab */}
        <p className="text-center text-xs text-text-secondary mt-5">
          {tab === "login" ? (
            <>
              Pas encore de compte ?{" "}
              <button
                type="button"
                onClick={() => switchTab("register")}
                className="text-accent hover:underline font-medium"
              >
                S'inscrire
              </button>
            </>
          ) : (
            <>
              Déjà un compte ?{" "}
              <button
                type="button"
                onClick={() => switchTab("login")}
                className="text-accent hover:underline font-medium"
              >
                Se connecter
              </button>
            </>
          )}
        </p>
      </div>

      {/* Legal */}
      <p className="mt-6 text-center text-[11px] text-text-secondary max-w-xs leading-relaxed">
        En continuant, vous acceptez nos{" "}
        <a href="#" className="underline hover:text-text transition-colors">
          CGU
        </a>{" "}
        et notre{" "}
        <a href="#" className="underline hover:text-text transition-colors">
          Politique de confidentialité
        </a>
        .
      </p>
    </div>
  );
}
