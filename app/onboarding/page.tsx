"use client";

import { useRouter } from "next/navigation";
import { useState, useRef } from "react";
import { ArrowLeft, TrendingUp, Home, Calculator, X } from "lucide-react";

/* ─── Phone mockup wrapper ─────────────────────────────────────── */
function PhoneFrame({
  children,
  width = 210,
  height = 340,
}: {
  children: React.ReactNode;
  width?: number;
  height?: number;
}) {
  const scale = width / 210;
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 28 * scale,
        background: "#0B0B1A",
        border: `2px solid #2A2A5A`,
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 24px 64px rgba(108,99,255,0.3)",
        flexShrink: 0,
      }}
    >
      {/* Dynamic island */}
      <div
        style={{
          position: "absolute",
          top: 10 * scale,
          left: "50%",
          transform: "translateX(-50%)",
          width: 60 * scale,
          height: 10 * scale,
          borderRadius: 10,
          background: "#000",
          zIndex: 10,
        }}
      />
      <div
        style={{
          paddingTop: 28 * scale,
          height: "100%",
          overflow: "hidden",
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          width: 210,
          position: "absolute",
          top: 0,
          left: 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ─── Mockup 1 — Dashboard ─────────────────────────────────────── */
function Mockup1() {
  const kpis = [
    { label: "Patrimoine net", value: "284 500 €", color: "#6C63FF" },
    { label: "Cashflow/mois", value: "+312 €", color: "#00D9A6" },
    { label: "Rendement net", value: "5.8 %", color: "#FBBF24" },
    { label: "Projection 10 ans", value: "412 K€", color: "#6C63FF" },
  ];
  const bars = [55, 62, 58, 70, 68, 76];

  return (
    <div style={{ padding: "28px 10px 0", color: "#E8E8F0", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: "#6C63FF" }}>Propfolio</span>
        <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#2A2A5A" }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginBottom: 8 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ background: "#12122A", borderRadius: 8, padding: "6px 7px", borderTop: `2px solid ${k.color}` }}>
            <div style={{ fontSize: 6.5, color: "#8888AA", marginBottom: 2 }}>{k.label}</div>
            <div style={{ fontSize: 8.5, fontWeight: 700, color: k.color, fontFamily: "monospace" }}>{k.value}</div>
          </div>
        ))}
      </div>
      <div style={{ background: "#12122A", borderRadius: 8, padding: "6px 8px" }}>
        <div style={{ fontSize: 6.5, color: "#8888AA", marginBottom: 5 }}>Évolution patrimoine</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 36 }}>
          {bars.map((h, i) => (
            <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: "2px 2px 0 0", background: i === bars.length - 1 ? "#6C63FF" : "#2A2A5A" }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Mockup 2 — Property detail ───────────────────────────────── */
function Mockup2() {
  const criteria = [
    { label: "Rendement", pct: 80, color: "#00D9A6" },
    { label: "Cashflow", pct: 65, color: "#6C63FF" },
    { label: "Occupation", pct: 90, color: "#00D9A6" },
    { label: "Valorisation", pct: 55, color: "#FBBF24" },
  ];

  return (
    <div style={{ padding: "28px 10px 0", color: "#E8E8F0", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <div style={{ width: 14, height: 14, borderRadius: 4, background: "#2A2A5A" }} />
        <span style={{ fontSize: 8, fontWeight: 700 }}>Studio — Lyon 7e</span>
      </div>
      <div style={{ background: "#12122A", borderRadius: 8, padding: "8px 8px", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <div style={{ position: "relative", width: 44, height: 44, flexShrink: 0 }}>
            <svg viewBox="0 0 44 44" style={{ width: "100%", height: "100%" }}>
              <circle cx="22" cy="22" r="17" fill="none" stroke="#2A2A5A" strokeWidth="3.5" />
              <circle cx="22" cy="22" r="17" fill="none" stroke="#6C63FF" strokeWidth="3.5"
                strokeDasharray={`${(71 / 100) * 106.8} 106.8`}
                strokeLinecap="round" transform="rotate(-90 22 22)" />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#6C63FF", fontFamily: "monospace" }}>71</span>
              <span style={{ fontSize: 5.5, color: "#8888AA" }}>/100</span>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 6.5, color: "#8888AA", marginBottom: 3 }}>Score investissement</div>
            {criteria.map((c) => (
              <div key={c.label} style={{ marginBottom: 2.5 }}>
                <span style={{ fontSize: 5.5, color: "#8888AA" }}>{c.label}</span>
                <div style={{ height: 3, background: "#2A2A5A", borderRadius: 2, overflow: "hidden", marginTop: 1 }}>
                  <div style={{ width: `${c.pct}%`, height: "100%", background: c.color, borderRadius: 2 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
        {[
          { label: "Cashflow net", value: "+312 €", color: "#00D9A6" },
          { label: "Rendement", value: "5.8 %", color: "#FBBF24" },
          { label: "Loyer CC", value: "780 €", color: "#E8E8F0" },
        ].map((k) => (
          <div key={k.label} style={{ background: "#12122A", borderRadius: 6, padding: "4px 5px" }}>
            <div style={{ fontSize: 5.5, color: "#8888AA", marginBottom: 1.5 }}>{k.label}</div>
            <div style={{ fontSize: 7.5, fontWeight: 700, color: k.color, fontFamily: "monospace" }}>{k.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Mockup 3 — Simulation ─────────────────────────────────────── */
function Mockup3() {
  const params = [
    { icon: "🏠", label: "Prix d'achat", value: "180 000 €" },
    { icon: "💶", label: "Loyer mensuel", value: "750 €" },
    { icon: "📊", label: "Taux crédit", value: "3.8 %" },
  ];
  const projBars = [42, 52, 58, 62, 68, 72, 76, 82, 88, 95];

  return (
    <div style={{ padding: "28px 10px 0", color: "#E8E8F0", fontFamily: "sans-serif" }}>
      <div style={{ fontSize: 8, fontWeight: 700, marginBottom: 8 }}>Simulation d&apos;acquisition</div>
      <div style={{ background: "#12122A", borderRadius: 8, padding: "7px 8px", marginBottom: 6 }}>
        {params.map((p, idx) => (
          <div key={p.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: idx < params.length - 1 ? 5 : 0, paddingBottom: idx < params.length - 1 ? 5 : 0, borderBottom: idx < params.length - 1 ? "1px solid #1A1A3E" : "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontSize: 8 }}>{p.icon}</span>
              <span style={{ fontSize: 6.5, color: "#8888AA" }}>{p.label}</span>
            </div>
            <span style={{ fontSize: 7.5, fontWeight: 700, fontFamily: "monospace" }}>{p.value}</span>
          </div>
        ))}
        <div style={{ marginTop: 6, paddingTop: 5, borderTop: "1px solid #1A1A3E", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 6.5, color: "#8888AA" }}>Cashflow net</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#00D9A6", fontFamily: "monospace" }}>+32 €/mois</span>
        </div>
      </div>
      <div style={{ background: "#12122A", borderRadius: 8, padding: "5px 8px" }}>
        <div style={{ fontSize: 6, color: "#8888AA", marginBottom: 4 }}>Projection 10 ans</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 30 }}>
          {projBars.map((h, i) => (
            <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: "2px 2px 0 0", background: "linear-gradient(to top, #6C63FF, #00D9A6)", opacity: 0.4 + i * 0.06 }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Slides data ───────────────────────────────────────────────── */
const SLIDES = [
  {
    badge: "Dashboard",
    icon: TrendingUp,
    title: "Pilotez votre patrimoine",
    subtitle: "Suivez patrimoine net, cashflow et rendement en un coup d'œil.",
    mockup: Mockup1,
  },
  {
    badge: "Analyse",
    icon: Home,
    title: "Analysez chaque bien",
    subtitle: "Score /100, cashflow net fiscal, détail des charges — décidez en confiance.",
    mockup: Mockup2,
  },
  {
    badge: "Simulation",
    icon: Calculator,
    title: "Simulez avant d'acheter",
    subtitle: "Projetez cashflow et patrimoine sur 10 ans avant de signer.",
    mockup: Mockup3,
  },
];

/* ─── Main component ────────────────────────────────────────────── */
export default function OnboardingPage() {
  const router = useRouter();
  const [slide, setSlide] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const touchStartX = useRef<number | null>(null);

  function complete() {
    try { localStorage.setItem("propfolio_onboarding_done", "1"); } catch {}
    document.cookie = "propfolio_onboarding_done=1; max-age=31536000; path=/; SameSite=Lax";
    router.push("/biens/nouveau");
  }

  function next() {
    if (slide < SLIDES.length - 1) setSlide(slide + 1);
    else complete();
  }

  function back() {
    if (slide > 0) setSlide(slide - 1);
  }

  function onTouchStart(e: React.TouchEvent) {
    if (zoomed) return;
    touchStartX.current = e.touches[0].clientX;
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (zoomed || touchStartX.current === null) return;
    const delta = touchStartX.current - e.changedTouches[0].clientX;
    if (delta > 50 && slide < SLIDES.length - 1) setSlide(slide + 1);
    if (delta < -50 && slide > 0) setSlide(slide - 1);
    touchStartX.current = null;
  }

  const isLast = slide === SLIDES.length - 1;
  const CurrentMockup = SLIDES[slide].mockup;
  const CurrentIcon = SLIDES[slide].icon;

  return (
    <div
      className="onboarding-root"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Outer container — max 440px, centered */}
      <div className="onboarding-container">
        {/* ── Top bar ── */}
        <div className="onboarding-topbar">
          <div style={{ width: 36 }}>
            {slide > 0 && (
              <button
                onClick={back}
                className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center text-text-secondary hover:text-text transition-colors"
              >
                <ArrowLeft size={16} />
              </button>
            )}
          </div>
          <span className="onboarding-logo">
            Propfolio
          </span>
          <button
            onClick={complete}
            className="text-sm text-text-secondary hover:text-text transition-colors"
            style={{ width: 36, textAlign: "right" }}
          >
            Passer
          </button>
        </div>

        {/* ── Slide content — vertical center ── */}
        <div className="onboarding-slide-area">
          {/* Text block (slides horizontally) */}
          <div className="onboarding-text-block">
            <div
              className="onboarding-text-track"
              style={{
                width: `${SLIDES.length * 100}%`,
                transform: `translateX(-${(slide * 100) / SLIDES.length}%)`,
              }}
            >
              {SLIDES.map((s, i) => {
                const Icon = s.icon;
                return (
                  <div key={i} className="onboarding-text-slide" style={{ width: `${100 / SLIDES.length}%` }}>
                    <div className="flex items-center gap-2 mb-2.5">
                      <div
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{
                          background: "rgba(108,99,255,0.12)",
                          color: "#6C63FF",
                          border: "1px solid rgba(108,99,255,0.25)",
                        }}
                      >
                        <Icon size={11} />
                        {s.badge}
                      </div>
                    </div>
                    <h1 className="onboarding-title">{s.title}</h1>
                    <p className="onboarding-subtitle">{s.subtitle}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Phone mockup — centered ── */}
          <div className="onboarding-phone-wrap">
            {/* Ambient glow */}
            <div
              style={{
                position: "absolute",
                inset: -40,
                background: "radial-gradient(ellipse at center, rgba(108,99,255,0.18) 0%, transparent 65%)",
                zIndex: 0,
                pointerEvents: "none",
              }}
            />
            {/* Tap hint ring */}
            <div
              style={{
                position: "absolute",
                inset: -6,
                borderRadius: 34,
                border: "1.5px solid rgba(108,99,255,0.2)",
                zIndex: 0,
                pointerEvents: "none",
              }}
            />
            {/* Phone — clickable */}
            <button
              onClick={() => setZoomed(true)}
              className="onboarding-phone-btn"
              onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.03)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
              aria-label="Agrandir l'aperçu"
            >
              <PhoneFrame width={210} height={340}>
                <CurrentMockup />
              </PhoneFrame>
              {/* Zoom hint badge */}
              <div
                style={{
                  position: "absolute",
                  bottom: 10,
                  right: 10,
                  background: "rgba(108,99,255,0.85)",
                  backdropFilter: "blur(8px)",
                  borderRadius: 8,
                  padding: "3px 7px",
                  fontSize: 9,
                  color: "#fff",
                  fontWeight: 600,
                  letterSpacing: "0.02em",
                  zIndex: 2,
                }}
              >
                Tap pour zoomer
              </div>
            </button>
          </div>
        </div>

        {/* ── Bottom navigation — pinned to bottom ── */}
        <div className="onboarding-bottom">
          {/* Dots */}
          <div className="flex items-center justify-center gap-2 mb-4">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setSlide(i)}
                style={{
                  height: 7,
                  width: slide === i ? 28 : 7,
                  borderRadius: 4,
                  background: slide === i ? "#6C63FF" : "rgba(108,99,255,0.25)",
                  transition: "width 0.25s ease, background 0.25s ease",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              />
            ))}
          </div>

          {/* CTA */}
          <button
            onClick={next}
            className="w-full py-4 rounded-2xl text-base font-bold text-white active:opacity-80"
            style={{
              background: "linear-gradient(135deg, #6C63FF 0%, #00D9A6 100%)",
              boxShadow: "0 8px 28px rgba(108,99,255,0.4)",
              transition: "opacity 0.15s ease, transform 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
          >
            {isLast ? "Commencer" : "Suivant"}
          </button>
        </div>
      </div>

      {/* ── Zoom overlay ── */}
      {zoomed && (
        <div
          onClick={() => setZoomed(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(11,11,26,0.88)",
            backdropFilter: "blur(16px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 24,
            animation: "fadeIn 0.2s ease",
          }}
        >
          {/* Close button */}
          <button
            onClick={(e) => { e.stopPropagation(); setZoomed(false); }}
            style={{
              position: "absolute",
              top: 20,
              right: 20,
              width: 36,
              height: 36,
              borderRadius: 12,
              background: "rgba(42,42,90,0.8)",
              border: "1px solid #2A2A5A",
              color: "#E8E8F0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <X size={16} />
          </button>

          {/* Slide indicator */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 14px",
              background: "rgba(108,99,255,0.12)",
              border: "1px solid rgba(108,99,255,0.25)",
              borderRadius: 20,
            }}
          >
            <CurrentIcon size={13} color="#6C63FF" />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#6C63FF" }}>
              {SLIDES[slide].badge}
            </span>
          </div>

          {/* Zoomed phone */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              animation: "zoomIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
          >
            <PhoneFrame width={300} height={486}>
              <CurrentMockup />
            </PhoneFrame>
          </div>

          {/* Tap to close hint */}
          <p style={{ fontSize: 12, color: "#5A5A7A", letterSpacing: "0.03em" }}>
            Appuyez n&apos;importe où pour fermer
          </p>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes zoomIn {
          from { transform: scale(0.7); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        /* ── Onboarding layout ────────────────────────── */
        .onboarding-root {
          height: 100vh;
          height: 100dvh;
          background: var(--bg);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          user-select: none;
        }

        .onboarding-container {
          width: 100%;
          max-width: 440px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
        }

        /* Top bar */
        .onboarding-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px 12px;
          flex-shrink: 0;
        }

        .onboarding-logo {
          background: linear-gradient(135deg, #6C63FF 0%, #00D9A6 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          font-weight: 800;
          font-size: 18px;
        }

        /* Slide area — fills remaining space, centers content */
        .onboarding-slide-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 0;
          overflow: hidden;
          gap: 24px;
        }

        /* Text block */
        .onboarding-text-block {
          width: 100%;
          padding: 0 24px;
          overflow: hidden;
          flex-shrink: 0;
        }

        .onboarding-text-track {
          display: flex;
          flex-direction: row;
          transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .onboarding-text-slide {
          padding-right: 6px;
          overflow-wrap: break-word;
          word-wrap: break-word;
        }

        .onboarding-title {
          font-size: 24px;
          font-weight: 700;
          color: var(--text);
          margin-bottom: 6px;
          line-height: 1.2;
          overflow-wrap: break-word;
          word-wrap: break-word;
        }

        .onboarding-subtitle {
          font-size: 13px;
          line-height: 1.6;
          color: var(--text-secondary);
          overflow-wrap: break-word;
          word-wrap: break-word;
        }

        /* Phone mockup wrap */
        .onboarding-phone-wrap {
          position: relative;
          flex-shrink: 0;
          max-width: 260px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .onboarding-phone-btn {
          position: relative;
          z-index: 1;
          background: none;
          border: none;
          padding: 0;
          cursor: zoom-in;
          display: block;
          transition: transform 0.2s ease;
        }

        /* Bottom nav */
        .onboarding-bottom {
          flex-shrink: 0;
          padding: 16px 24px 36px;
        }

        /* ── Desktop: slightly larger title ──────────── */
        @media (min-width: 768px) {
          .onboarding-title {
            font-size: 28px;
          }
        }
      `}</style>
    </div>
  );
}
