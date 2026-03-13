"use client";

import Link from "next/link";
import { ChevronLeft, Activity, ArrowDown, ArrowUp, Minus, Info, Landmark, CheckCircle2 } from "lucide-react";
import { MARKET_RATES, type BankRate } from "@/lib/market-rates";

function TrendIcon({ trend }: { trend: BankRate["trend"] }) {
  if (trend === "down") return <ArrowDown size={14} className="text-green" />;
  if (trend === "up") return <ArrowUp size={14} className="text-red" />;
  return <Minus size={14} className="text-text-secondary" />;
}

export default function TauxPage() {
  return (
    <div className="px-4 pt-5 pb-20 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center text-text-secondary hover:text-text transition-colors">
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-text leading-tight">Comparatif des Taux</h1>
          <p className="text-text-secondary text-sm">Mise à jour : Mars 2026</p>
        </div>
      </div>

      {/* Market Sentiment */}
      <div className="bg-accent/5 border border-accent/10 rounded-3xl p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center text-accent">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-sm font-bold text-text">Tendance : Baissière</p>
            <p className="text-xs text-text-secondary">Le marché se détend après les annonces de la BCE.</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 px-3 py-1 bg-green/10 text-green rounded-full border border-green/20">
            <ArrowDown size={12} />
            <span className="text-xs font-bold">-0.15%</span>
          </div>
        </div>
        <p className="text-[13px] text-text-secondary leading-relaxed">
          Les taux continuent leur lente décrue. C&apos;est le moment idéal pour renégocier vos anciens prêts ou lancer vos projets d&apos;acquisition. Les banques en ligne restent les plus agressives sur les dossiers standards.
        </p>
      </div>

      {/* Main Comparison Table */}
      <div className="bg-card border border-border rounded-3xl overflow-hidden">
        <div className="p-4 border-b border-border bg-bg/30">
          <h2 className="text-sm font-bold text-text flex items-center gap-2">
            <Landmark size={16} className="text-accent" />
            Taux nominaux par établissement
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-text-secondary border-b border-border/50 bg-bg/10">
                <th className="text-left font-bold px-5 py-3">Banque</th>
                <th className="text-center font-bold px-4 py-3">15 ans</th>
                <th className="text-center font-bold px-4 py-3">20 ans</th>
                <th className="text-center font-bold px-4 py-3">25 ans</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {MARKET_RATES.map((b) => (
                <tr key={b.bank} className="group hover:bg-bg/40 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-text">{b.bank}</span>
                      <TrendIcon trend={b.trend} />
                    </div>
                    {b.description && <p className="text-[10px] text-text-secondary mt-0.5 max-w-[140px] leading-tight">{b.description}</p>}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="text-sm text-text-secondary">{b.rate15}%</span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="inline-block px-3 py-1 rounded-lg bg-accent/5 border border-accent/10">
                      <span className="text-sm font-bold text-accent">{b.rate20}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center text-sm text-text-secondary">{b.rate25}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Conseils */}
      <div className="grid grid-cols-1 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-accent">
            <CheckCircle2 size={18} />
            <h3 className="text-sm font-bold">Conseil de pro</h3>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">
            Ne regardez pas seulement le taux nominal. Le <span className="text-text font-semibold">TAEG (Taux Annuel Effectif Global)</span> inclut l&apos;assurance emprunteur et les frais de dossier. Une assurance externe peut vous faire gagner jusqu&apos;à 0.20% sur votre coût total.
          </p>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="flex gap-3 p-4 bg-bg border border-border rounded-2xl">
        <Info size={16} className="text-text-secondary shrink-0 mt-0.5" />
        <p className="text-[10px] text-text-secondary leading-relaxed italic">
          Ces taux sont donnés à titre indicatif pour un profil &quot;Excellent&quot;. Ils peuvent varier selon vos revenus, votre apport et votre région. Sources : Meilleurtaux, Prêt d&apos;Union, données BCE.
        </p>
      </div>
    </div>
  );
}
