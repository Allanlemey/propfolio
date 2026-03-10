"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Sun, Moon, Send, Check } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { supabase } from "@/lib/supabase";

// ── Subjects ──────────────────────────────────────────────────

const SUBJECTS = [
  { value: "bug", label: "🐛 Signaler un bug" },
  { value: "suggestion", label: "💡 Suggestion d'amélioration" },
  { value: "question", label: "❓ Question sur l'application" },
  { value: "facturation", label: "💳 Facturation / abonnement" },
  { value: "autre", label: "✉️ Autre" },
] as const;

type SubjectValue = (typeof SUBJECTS)[number]["value"];

// ── Header ────────────────────────────────────────────────────

function PageHeader() {
  const { theme, toggle } = useTheme();
  return (
    <div className="sticky top-0 z-40 bg-card border-b border-border">
      <div className="flex items-center gap-3 px-4 py-3.5 max-w-2xl mx-auto">
        <Link
          href="/profil"
          className="w-9 h-9 rounded-xl bg-bg border border-border flex items-center justify-center text-text-secondary hover:text-text transition-colors shrink-0"
        >
          <ArrowLeft size={16} />
        </Link>
        <p className="flex-1 text-sm font-bold text-text">Nous contacter</p>
        <button
          onClick={toggle}
          aria-label="Changer le thème"
          className="p-2 rounded-lg text-text-secondary hover:text-text hover:bg-bg transition-colors"
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState<SubjectValue>("question");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill from session
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setEmail(user.email ?? "");
      supabase
        .from("users")
        .select("name")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.name) setName(data.name);
        });
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!message.trim()) {
      setError("Veuillez écrire un message.");
      return;
    }

    setSending(true);

    // Build mailto link with pre-filled content and open it
    const subjectLabel =
      SUBJECTS.find((s) => s.value === subject)?.label ?? subject;
    const body = [
      `De : ${name || "Non renseigné"} <${email}>`,
      `Sujet : ${subjectLabel}`,
      "",
      message,
    ].join("\n");

    const mailto = `mailto:contact@propfolio.fr?subject=${encodeURIComponent(
      `[Propfolio] ${subjectLabel}`
    )}&body=${encodeURIComponent(body)}`;

    window.location.href = mailto;

    // Brief delay then show confirmation
    setTimeout(() => {
      setSending(false);
      setSent(true);
      setMessage("");
    }, 600);
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-bg">
        <PageHeader />
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
            style={{
              background:
                "linear-gradient(135deg, rgba(0,217,166,0.2) 0%, rgba(108,99,255,0.2) 100%)",
              border: "1px solid rgba(0,217,166,0.3)",
            }}
          >
            <Check size={28} className="text-green" strokeWidth={2} />
          </div>
          <h2 className="text-lg font-bold text-text mb-2">
            Message prêt à envoyer
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed mb-8 max-w-xs">
            Votre client mail s&apos;est ouvert avec le message pré-rempli.
            Envoyez-le depuis votre application de messagerie.
          </p>
          <div className="flex gap-3">
            <Link
              href="/profil"
              className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-card border border-border text-text hover:border-accent/40 transition-colors"
            >
              Retour au profil
            </Link>
            <button
              type="button"
              onClick={() => setSent(false)}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-accent text-white hover:opacity-90 transition-opacity"
            >
              Nouveau message
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <PageHeader />

      <form
        onSubmit={handleSubmit}
        className="px-4 py-6 max-w-2xl mx-auto space-y-5"
      >
        {/* Intro */}
        <div className="bg-accent/5 border border-accent/20 rounded-2xl px-4 py-3.5">
          <p className="text-sm text-text-secondary leading-relaxed">
            Une question, un bug ou une suggestion ? Écrivez-nous, nous
            répondons sous 48 h.
          </p>
        </div>

        {/* Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            Prénom / Nom
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Votre prénom"
            className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-text placeholder:text-text-secondary outline-none focus:border-accent transition-colors"
          />
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="votre@email.fr"
            required
            className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-text placeholder:text-text-secondary outline-none focus:border-accent transition-colors"
          />
        </div>

        {/* Subject */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            Sujet
          </label>
          <div className="grid grid-cols-1 gap-2">
            {SUBJECTS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setSubject(value)}
                className={`text-left px-4 py-2.5 rounded-xl text-sm border transition-all ${
                  subject === value
                    ? "bg-accent/10 border-accent text-text font-medium"
                    : "bg-card border-border text-text-secondary hover:border-accent/40 hover:text-text"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Message */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            Message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Décrivez votre demande en détail…"
            rows={6}
            required
            className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-text placeholder:text-text-secondary outline-none focus:border-accent transition-colors resize-none"
          />
          <p className="text-[11px] text-text-secondary text-right">
            {message.length} caractères
          </p>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-red bg-red/10 border border-red/20 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={sending || !message.trim() || !email.trim()}
          className="w-full py-3.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
          style={{
            background:
              !sending && message.trim() && email.trim()
                ? "linear-gradient(135deg, #6C63FF 0%, #00D9A6 100%)"
                : undefined,
            backgroundColor:
              sending || !message.trim() || !email.trim()
                ? "var(--border)"
                : undefined,
          }}
        >
          {sending ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Ouverture du mail…
            </>
          ) : (
            <>
              <Send size={15} strokeWidth={2} />
              Envoyer le message
            </>
          )}
        </button>

        <p className="text-[11px] text-text-secondary text-center leading-relaxed">
          En cliquant sur Envoyer, votre client mail s&apos;ouvrira avec le
          message pré-rempli à{" "}
          <span className="text-accent">contact@propfolio.fr</span>
        </p>
      </form>
    </div>
  );
}
