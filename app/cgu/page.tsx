"use client";

import Link from "next/link";
import { ArrowLeft, Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

function LegalHeader({ title }: { title: string }) {
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
        <p className="flex-1 text-sm font-bold text-text">{title}</p>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-bold text-text">{title}</h2>
      <div className="text-sm text-text-secondary leading-relaxed space-y-2">
        {children}
      </div>
    </div>
  );
}

export default function CguPage() {
  return (
    <div className="min-h-screen bg-bg">
      <LegalHeader title="Conditions générales d'utilisation" />

      <div className="px-4 py-6 max-w-2xl mx-auto space-y-6">
        {/* Date */}
        <p className="text-xs text-text-secondary font-mono">
          Dernière mise à jour : mars 2026
        </p>

        <Section title="1. Objet">
          <p>
            Propfolio est une application web de pilotage de patrimoine
            immobilier destinée aux investisseurs locatifs français, notamment
            sous le régime LMNP (Loueur Meublé Non Professionnel). Elle permet
            de centraliser, calculer et visualiser les performances de biens
            immobiliers locatifs.
          </p>
          <p>
            Les présentes conditions générales d&apos;utilisation (CGU)
            régissent l&apos;accès et l&apos;utilisation du service accessible
            à l&apos;adresse propfolio.fr.
          </p>
        </Section>

        <Section title="2. Accès au service">
          <p>
            L&apos;accès à Propfolio est réservé aux personnes physiques
            majeures disposant d&apos;un compte créé via une adresse email
            valide. L&apos;inscription est gratuite et donne accès à un plan
            limité (1 bien, cashflow brut).
          </p>
          <p>
            Un abonnement Premium est disponible pour accéder à
            l&apos;ensemble des fonctionnalités (biens illimités, cashflow
            net fiscal, projections, score investissement).
          </p>
        </Section>

        <Section title="3. Responsabilité de l'utilisateur">
          <p>
            L&apos;utilisateur est seul responsable des informations saisies
            dans l&apos;application (montants, dates, régimes fiscaux).
            Propfolio ne saurait être tenu responsable d&apos;erreurs de
            calcul résultant de données incorrectes ou incomplètes.
          </p>
          <p>
            L&apos;utilisateur s&apos;engage à ne pas utiliser le service à
            des fins illicites ou contraires aux présentes conditions.
          </p>
        </Section>

        <Section title="4. Calculs fiscaux — avertissement">
          <p>
            Les calculs de cashflow, rendement et impôt fournis par Propfolio
            sont <strong className="text-text">indicatifs</strong>. Ils
            reposent sur des hypothèses simplifiées (TMI par défaut 30 %,
            abattements forfaitaires). Ils ne constituent pas un conseil
            fiscal, comptable ou juridique.
          </p>
          <p>
            Nous vous recommandons de consulter un expert-comptable ou un
            conseiller fiscal pour toute décision d&apos;investissement.
          </p>
        </Section>

        <Section title="5. Propriété intellectuelle">
          <p>
            L&apos;ensemble du contenu de Propfolio (design, code, textes,
            calculs, marque) est la propriété exclusive de ses créateurs et
            est protégé par le droit d&apos;auteur français. Toute
            reproduction, même partielle, est interdite sans autorisation
            écrite préalable.
          </p>
        </Section>

        <Section title="6. Disponibilité et évolution du service">
          <p>
            Propfolio se réserve le droit de modifier, suspendre ou
            interrompre tout ou partie du service à tout moment, notamment
            pour maintenance ou évolution technique, sans préavis ni
            indemnité.
          </p>
        </Section>

        <Section title="7. Résiliation">
          <p>
            L&apos;utilisateur peut supprimer son compte à tout moment depuis
            la page Profil ou en contactant le support. La suppression entraîne
            l&apos;effacement définitif de toutes les données associées.
          </p>
        </Section>

        <Section title="8. Droit applicable">
          <p>
            Les présentes CGU sont soumises au droit français. Tout litige
            sera porté devant les tribunaux compétents de Paris.
          </p>
        </Section>

        <Section title="9. Contact">
          <p>
            Pour toute question relative aux présentes CGU :{" "}
            <a
              href="mailto:contact@propfolio.fr"
              className="text-accent underline underline-offset-2"
            >
              contact@propfolio.fr
            </a>
          </p>
        </Section>

        <div className="pt-2 pb-6 border-t border-border">
          <p className="text-xs text-text-secondary text-center">
            © 2026 Propfolio — Tous droits réservés
          </p>
        </div>
      </div>
    </div>
  );
}
