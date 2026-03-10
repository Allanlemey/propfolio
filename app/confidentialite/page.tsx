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

export default function ConfidentialitePage() {
  return (
    <div className="min-h-screen bg-bg">
      <LegalHeader title="Politique de confidentialité" />

      <div className="px-4 py-6 max-w-2xl mx-auto space-y-6">
        {/* Date */}
        <p className="text-xs text-text-secondary font-mono">
          Dernière mise à jour : mars 2026
        </p>

        <Section title="1. Responsable du traitement">
          <p>
            Le responsable du traitement des données personnelles collectées
            via Propfolio (propfolio.fr) est l&apos;éditeur du service,
            joignable à l&apos;adresse{" "}
            <a
              href="mailto:contact@propfolio.fr"
              className="text-accent underline underline-offset-2"
            >
              contact@propfolio.fr
            </a>
            .
          </p>
        </Section>

        <Section title="2. Données collectées">
          <p>Propfolio collecte uniquement les données nécessaires au service :</p>
          <ul className="space-y-1.5 pl-4">
            {[
              "Adresse email (authentification)",
              "Prénom (facultatif, personnalisation)",
              "Données patrimoniales saisies : biens, prix, loyers, charges, crédits",
              "Régime fiscal et tranche d'imposition renseignés",
              "Données techniques : logs de connexion, préférences d'affichage (thème)",
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-accent shrink-0 mt-0.5">·</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p>
            Aucune donnée bancaire, aucun justificatif de revenus ni aucune
            pièce d&apos;identité ne sont collectés.
          </p>
        </Section>

        <Section title="3. Finalités du traitement">
          <p>Vos données sont utilisées exclusivement pour :</p>
          <ul className="space-y-1.5 pl-4">
            {[
              "Fournir les fonctionnalités de l'application (calculs, tableaux de bord)",
              "Assurer l'authentification et la sécurité du compte",
              "Améliorer le service via des statistiques d'usage anonymisées",
              "Envoyer des notifications liées à votre patrimoine (avec votre consentement)",
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-accent shrink-0 mt-0.5">·</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="4. Hébergement et sous-traitants">
          <p>
            Les données sont hébergées sur{" "}
            <strong className="text-text">Supabase</strong> (infrastructure
            AWS, région Europe — Frankfurt) et{" "}
            <strong className="text-text">Vercel</strong> (CDN et déploiement
            de l&apos;application). Ces prestataires sont soumis au RGPD et
            disposent de certifications de sécurité appropriées.
          </p>
          <p>
            Aucune donnée n&apos;est vendue, partagée ou revendue à des tiers
            à des fins publicitaires ou commerciales.
          </p>
        </Section>

        <Section title="5. Durée de conservation">
          <p>
            Vos données sont conservées pendant toute la durée d&apos;activité
            de votre compte. En cas de suppression du compte, toutes les
            données associées sont effacées dans un délai de 30 jours.
          </p>
        </Section>

        <Section title="6. Vos droits (RGPD)">
          <p>
            Conformément au Règlement Général sur la Protection des Données
            (RGPD — UE 2016/679), vous disposez des droits suivants :
          </p>
          <ul className="space-y-1.5 pl-4">
            {[
              "Droit d'accès à vos données personnelles",
              "Droit de rectification (correction d'informations inexactes)",
              "Droit à l'effacement (« droit à l'oubli »)",
              "Droit à la portabilité (export de vos données)",
              "Droit d'opposition au traitement",
              "Droit de retrait du consentement à tout moment",
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-accent shrink-0 mt-0.5">·</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p>
            Pour exercer ces droits, contactez-nous à{" "}
            <a
              href="mailto:contact@propfolio.fr"
              className="text-accent underline underline-offset-2"
            >
              contact@propfolio.fr
            </a>
            . Nous répondons dans un délai de 30 jours.
          </p>
        </Section>

        <Section title="7. Cookies et traceurs">
          <p>
            Propfolio utilise uniquement des cookies techniques strictement
            nécessaires au fonctionnement de l&apos;authentification (session
            Supabase). Aucun cookie publicitaire ni traceur tiers
            n&apos;est utilisé.
          </p>
        </Section>

        <Section title="8. Sécurité">
          <p>
            Toutes les communications entre votre navigateur et nos serveurs
            sont chiffrées via HTTPS/TLS. Les mots de passe ne sont jamais
            stockés en clair — l&apos;authentification est gérée par Supabase
            Auth (bcrypt). L&apos;accès aux données est protégé par des
            politiques Row Level Security (RLS) garantissant qu&apos;un
            utilisateur ne peut accéder qu&apos;à ses propres données.
          </p>
        </Section>

        <Section title="9. Modifications de cette politique">
          <p>
            Nous nous réservons le droit de modifier cette politique à tout
            moment. En cas de modification substantielle, vous serez informé
            par email ou notification dans l&apos;application.
          </p>
        </Section>

        <Section title="10. Réclamation">
          <p>
            Si vous estimez que vos droits ne sont pas respectés, vous pouvez
            déposer une réclamation auprès de la{" "}
            <strong className="text-text">CNIL</strong> (Commission Nationale
            de l&apos;Informatique et des Libertés) —{" "}
            <span className="font-mono text-xs">cnil.fr</span>.
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
