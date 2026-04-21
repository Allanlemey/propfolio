import { TrendingUp } from "lucide-react";
import { calcRemainingCapital } from "@/lib/calculations";

function fmt(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(Math.abs(n)));
}

export interface PrintableReportProps {
  price: number;
  loyer: number;
  notaire: number;
  taux: number;
  duree: number;
  apport: number;
  cashflow: number;
  rendementBrut: number;
  rendementNet: number;
  monthlyTax: number;
  mp: number;
  regime: string;
  name: string;
  revaluation: number;
  vacance: number;
  inflationLoyers: number;
  dpe: string;
  listingUrl: string;
  tmi: number;
  travaux: number;
}

export function PDFReport({
  price, loyer, notaire, taux, duree, apport,
  cashflow, rendementBrut, rendementNet, monthlyTax, mp, regime, name,
  revaluation, inflationLoyers, dpe, listingUrl, tmi, travaux,
}: PrintableReportProps) {
  const totalAcquisition = price + notaire + travaux;
  const principal = totalAcquisition - apport;

  const annualAmortissementBien = price * 0.04;
  const annualAmortissementTravaux = travaux * 0.1;
  const totalAnnualAmortissement = annualAmortissementBien + annualAmortissementTravaux;

  const annualChargesTotal = (price * 0.008) + 600 + 150 + (loyer * 12 * 0.025) + 300;
  const annualInterest = principal * (taux / 100);
  const totalAnnualDeductions = totalAnnualAmortissement + annualChargesTotal + annualInterest;

  let accumulatedDeficit = 0;
  const fullProjection = Array.from({ length: 20 }, (_, i) => i + 1).map(y => {
    const lYear = (loyer * 12) * Math.pow(1 + (inflationLoyers || 1.8) / 100, y - 1);
    const cYear = annualChargesTotal * Math.pow(1.015, y - 1);
    const capStart = calcRemainingCapital(principal, taux, duree, y - 1);
    const intYear = capStart * (taux / 100);
    const amortPropertyYear = y <= 20 ? annualAmortissementBien : 0;
    const amortTravauxYear = y <= 10 ? annualAmortissementTravaux : 0;
    const currentAmort = amortPropertyYear + amortTravauxYear;
    const totalDeductionsYear = cYear + intYear + currentAmort;
    const rawResult = lYear - totalDeductionsYear;

    let taxBase = 0;
    if (rawResult > 0) {
      const usedDeficit = Math.min(rawResult, accumulatedDeficit);
      taxBase = rawResult - usedDeficit;
      accumulatedDeficit -= usedDeficit;
    } else {
      accumulatedDeficit += Math.abs(rawResult);
    }

    const yearlyTax = regime.toLowerCase().includes("réel")
      ? taxBase * (tmi + 0.172)
      : (lYear * (regime.toLowerCase().includes("micro-bic") ? 0.5 : 0.7)) * (tmi + 0.172);

    return { y, lYear, totalDeductionsYear, taxBase, yearlyTax, accumulatedDeficit };
  });

  const displayProjection = fullProjection.filter(p => [1, 5, 10, 15, 20].includes(p.y));

  return (
    <div className="bg-white print:block overflow-hidden">
      {/* Page 1: Analyse Financière */}
      <div className="p-10 space-y-8 bg-white text-slate-800 h-[29.7cm] relative flex flex-col font-sans border border-slate-100 print:border-none print:shadow-none print:m-0 print:overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-indigo-600 via-purple-500 to-emerald-400" />

        <div className="flex justify-between items-start pt-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-lg">P</div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Propfolio <span className="text-indigo-600">Expert</span></h1>
            </div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-widest">
              {new Date().toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold text-slate-900 leading-tight">{name}</h2>
            <p className="text-sm text-slate-500 font-medium">Analyse Financière Prévisionnelle</p>
            {listingUrl && (
              <p className="text-[10px] text-indigo-500 font-mono mt-1 underline truncate max-w-[250px]">{listingUrl}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Cashflow Mensuel", value: `${cashflow >= 0 ? "+" : "−"}${fmt(Math.abs(cashflow))} €`, color: cashflow >= 0 ? "text-emerald-600" : "text-rose-600", bg: cashflow >= 0 ? "bg-emerald-50" : "bg-rose-50" },
            { label: "Rendement Net", value: `${rendementNet.toFixed(2)} %`, color: "text-indigo-600", bg: "bg-indigo-50" },
            { label: "Apport", value: `${fmt(apport)} €`, color: "text-slate-700", bg: "bg-slate-50" },
            { label: "DPE", value: dpe || "N/A", color: "text-slate-700", bg: "bg-slate-50" },
          ].map((stat, i) => (
            <div key={i} className={`${stat.bg} p-4 rounded-2xl border border-white/50 shadow-sm`}>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{stat.label}</p>
              <p className={`text-xl font-black ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-12 gap-8 items-stretch flex-1">
          <div className="col-span-7 space-y-6">
            <section className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-3">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                Structure de l&apos;Acquisition
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm"><span className="text-slate-500">Prix d&apos;achat</span><span className="font-semibold">{fmt(price)} €</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">Frais de notaire</span><span className="font-semibold">{fmt(notaire)} €</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">Travaux</span><span className="font-semibold">{fmt(travaux)} €</span></div>
                <div className="flex justify-between pt-2 border-t border-slate-200"><span className="font-bold">Total Projet</span><span className="font-black text-indigo-600">{fmt(totalAcquisition)} €</span></div>
              </div>
            </section>

            <section className="bg-white p-5 rounded-2xl border-2 border-indigo-100 space-y-4 shadow-sm">
              <h3 className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                Analyse Amortissable
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[9px] text-slate-400 font-bold uppercase">Immobilier (80%)</p>
                  <p className="text-sm font-black text-slate-700">{fmt(price * 0.8)} €</p>
                  <p className="text-[8px] text-slate-400 italic">Sur ~20 ans (5%/an)</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] text-slate-400 font-bold uppercase">Travaux & Mobilier</p>
                  <p className="text-sm font-black text-slate-700">{fmt(travaux)} €</p>
                  <p className="text-[8px] text-slate-400 italic">Sur ~10 ans (10%/an)</p>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                <p className="text-xs font-bold">Dotation Annuelle</p>
                <p className="text-lg font-black text-indigo-600">{fmt(totalAnnualAmortissement)} €</p>
              </div>
            </section>

            <section className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-4">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Bilan Fiscal Annuel
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm items-center">
                  <span className="text-slate-500 font-medium">Recettes annuelles</span>
                  <span className="font-black text-emerald-600">+{fmt(loyer * 12)} €</span>
                </div>
                <div className="space-y-2 p-3 bg-white/50 rounded-xl border border-slate-100">
                  <div className="flex justify-between text-[10px]"><span className="text-slate-400">- Charges & Taxes</span><span className="font-medium text-rose-400">-{fmt(annualChargesTotal)} €</span></div>
                  <div className="flex justify-between text-[10px]"><span className="text-slate-400">- Intérêts (Y1)</span><span className="font-medium text-rose-400">-{fmt(annualInterest)} €</span></div>
                  <div className="flex justify-between text-[10px] font-bold pt-1 border-t border-slate-100/50"><span className="text-slate-400">- Amortissements</span><span className="text-indigo-500">-{fmt(totalAnnualAmortissement)} €</span></div>
                </div>
                <div className="flex justify-between text-sm py-2 px-3 bg-slate-900 rounded-xl">
                  <span className="text-slate-400 text-[10px] font-bold uppercase">Résultat Fiscal</span>
                  <span className={`font-black ${loyer * 12 - totalAnnualDeductions > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                    {loyer * 12 - totalAnnualDeductions > 0
                      ? `${fmt(loyer * 12 - totalAnnualDeductions)} €`
                      : `DÉFICIT (${fmt(Math.abs(loyer * 12 - totalAnnualDeductions))} €)`}
                  </span>
                </div>
              </div>
            </section>
          </div>

          <div className="col-span-5 space-y-6">
            <section className="bg-slate-900 p-5 rounded-2xl text-white shadow-xl space-y-5">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300">Exploitation</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-400 text-xs">Loyer mensuel HC</span>
                  <span className="text-2xl font-black">{fmt(loyer)} €</span>
                </div>
                <div className="space-y-3 pt-4 border-t border-white/10">
                  <div className="flex justify-between text-[10px]"><span className="text-slate-400">Rendement Brut</span><span className="text-emerald-400 font-bold">{rendementBrut.toFixed(2)} %</span></div>
                  <div className="flex justify-between text-[10px]"><span className="text-slate-400">Rendement Net</span><span className="text-slate-200 font-bold">{rendementNet.toFixed(2)} %</span></div>
                  <div className="pt-2">
                    <div className="flex justify-between text-[10px] items-center">
                      <span className="text-slate-400">Impôt Mensuel</span>
                      <span className={`font-bold ${Math.round(monthlyTax) > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                        {Math.round(monthlyTax) > 0 ? `${fmt(monthlyTax)} €/m` : "0 € (Défiscalisé)"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-3">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Financement</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Emprunt</span><span>{fmt(principal)} €</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Taux</span><span>{taux} %</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Durée</span><span>{duree} ans</span></div>
                <div className="flex justify-between pt-2 border-t border-slate-200"><span className="font-bold">Mensualité</span><span className="font-black text-rose-500">{fmt(mp)} €/m</span></div>
              </div>
            </section>

            <div className="p-5 rounded-3xl border-2 border-dashed border-slate-100 text-center space-y-2">
              <TrendingUp size={24} className="mx-auto text-indigo-600 mb-1" />
              <p className="text-[10px] font-bold text-slate-400 uppercase">Valeur à 10 ans</p>
              <p className="text-lg font-black text-slate-900">+{revaluation}% <span className="text-slate-400 font-normal">/an</span></p>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-100 flex justify-between items-end opacity-60">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-900 uppercase">Propfolio Expert Report</p>
            <p className="text-[7px] text-slate-400 max-w-xs leading-tight">Ce document est une projection basée sur vos hypothèses. Pas de valeur contractuelle.</p>
          </div>
          <p className="text-xs font-black text-slate-300">PAGE 1/2</p>
        </div>
      </div>

      {/* Page 2: Projection Table */}
      <div className="p-10 space-y-8 bg-white text-slate-800 h-[29.7cm] relative flex flex-col font-sans print:m-0 break-before-page print:overflow-hidden">
        <div className="flex justify-between items-end mb-4 pt-10">
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Analyse Prospective <span className="text-indigo-600">20 ans</span></h3>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{name}</p>
        </div>

        <section className="space-y-4 flex-1">
          <div className="overflow-hidden rounded-2xl border border-slate-100 shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Année</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Loyers</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Déductions</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Déficit Reporté</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Impôt Final</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {displayProjection.map((p, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900 text-sm">Année {p.y}</td>
                    <td className="px-6 py-4 text-right text-emerald-600 font-bold text-sm">{fmt(p.lYear)} €</td>
                    <td className="px-6 py-4 text-right text-rose-500/80 text-sm">-{fmt(p.totalDeductionsYear)} €</td>
                    <td className="px-6 py-4 text-right text-indigo-600 font-bold text-sm">{p.accumulatedDeficit > 0 ? `${fmt(p.accumulatedDeficit)} €` : "0 €"}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${p.yearlyTax > 0 ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>
                        {p.yearlyTax > 0 ? `${fmt(p.yearlyTax)} €` : "0 €"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-5 bg-indigo-50/30 rounded-2xl border border-indigo-100/50">
            <h4 className="text-xs font-black text-indigo-600 uppercase mb-2">Note sur le Report de Déficit</h4>
            <p className="text-[10px] text-slate-500 leading-relaxed italic">
              Le régime LMNP Réel permet de reporter indéfiniment vos déficits (amortissements non consommés).
              Le tableau ci-dessus simule cette &quot;réserve fiscale&quot; qui annule votre impôt tant qu&apos;elle n&apos;est pas épuisée.
            </p>
          </div>
        </section>

        <div className="pt-6 border-t border-slate-100 flex justify-between items-end opacity-60">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-900 uppercase">Propfolio Expert Report</p>
            <p className="text-[7px] text-slate-400 max-w-xs leading-tight">Généré le {new Date().toLocaleDateString()}. Document d&apos;aide à la décision uniquement.</p>
          </div>
          <div className="text-right flex items-center gap-4">
            <div className="px-3 py-1 bg-slate-100 text-[9px] font-black rounded-lg">ID_{Math.random().toString(36).substring(7).toUpperCase()}</div>
            <p className="text-xs font-black text-slate-300">PAGE 2/2</p>
          </div>
        </div>
      </div>
    </div>
  );
}
