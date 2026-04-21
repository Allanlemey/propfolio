import { GraduationCap, PlayCircle, Building, Landmark, TrendingUp, LucideIcon } from "lucide-react";

export type Article = {
  id: string;
  title: string;
  category: string;
  type: "cours" | "actu";
  date: string;
  icon: LucideIcon;
  color: string;
  content: React.ReactNode;
};

export const NEWS_ARTICLES: Article[] = [
  {
    id: "fiscalite-lmnp",
    title: "5 astuces pour optimiser votre fiscalité LMNP cette année",
    category: "Fiscalité",
    type: "actu",
    date: "Aujourd'hui",
    icon: GraduationCap,
    color: "text-accent",
    content: (
      <div className="space-y-4">
        <p>Le statut de Loueur en Meublé Non Professionnel (LMNP) offre des avantages fiscaux considérables, mais encore faut-il savoir les exploiter. Voici nos 5 conseils pour 2026 :</p>
        <ol className="list-decimal pl-5 space-y-2">
          <li><strong>Passez au régime réel :</strong> Même si le micro-BIC est plus simple, le régime réel permet souvent d&apos;effacer totalement votre impôt grâce aux amortissements.</li>
          <li><strong>Amortissez les meubles :</strong> N&apos;oubliez pas que le mobilier s&apos;amortit sur une durée courte (5 à 10 ans), ce qui booste vos charges déductibles.</li>
          <li><strong>Déduisez vos frais d&apos;acquisition :</strong> En LMNP au réel, vous pouvez choisir de déduire vos frais de notaire en charges la première année.</li>
          <li><strong>Adhérez à un CGA :</strong> L&apos;adhésion à un Centre de Gestion Agréé peut vous éviter des majorations et vous offrir des réductions d&apos;impôts pour frais de comptabilité.</li>
          <li><strong>Préparez la sortie :</strong> Anticipez la revente car la plus-value des particuliers s&apos;applique, ce qui est très avantageux par rapport au régime professionnel.</li>
        </ol>
      </div>
    )
  },
  {
    id: "marseille-2026",
    title: "Les meilleurs quartiers où investir à Marseille en 2026",
    category: "Marché",
    type: "cours",
    date: "Hier",
    icon: PlayCircle,
    color: "text-green",
    content: (
      <div className="space-y-4">
        <p>Marseille continue sa transformation. Avec l&apos;extension du tramway et les projets Euroméditerranée, certains quartiers présentent un potentiel de plus-value exceptionnel :</p>
        <div className="space-y-3">
          <div className="bg-bg p-3 rounded-xl border border-border">
            <h4 className="font-bold text-sm text-accent">La Capelette (10ème)</h4>
            <p className="text-xs text-text-secondary mt-1">Proximité des facultés et arrivée prochaine du tramway. Un secteur encore abordable pour du locatif étudiant.</p>
          </div>
          <div className="bg-bg p-3 rounded-xl border border-border">
            <h4 className="font-bold text-sm text-accent">Saint-Just (13ème)</h4>
            <p className="text-xs text-text-secondary mt-1">Un quartier résidentiel qui bénéficie de la saturation de l&apos;hyper-centre. Très bonne demande pour de la colocation.</p>
          </div>
          <div className="bg-bg p-3 rounded-xl border border-border">
            <h4 className="font-bold text-sm text-accent">L&apos;Estaque (16ème)</h4>
            <p className="text-xs text-text-secondary mt-1">Pour les investissements en courte durée. Le charme du village de pêcheurs attire de plus en plus de touristes en quête d&apos;authenticité.</p>
          </div>
        </div>
      </div>
    )
  },
  {
    id: "dpe-loyers",
    title: "Comprendre l'impact des nouvelles normes DPE sur vos loyers",
    category: "Réglementation",
    type: "actu",
    date: "12 Mar.",
    icon: Building,
    color: "text-[#FBBF24]",
    content: (
      <div className="space-y-4">
        <p>Le calendrier d&apos;interdiction de louer les passoires thermiques se précise. Ne vous laissez pas surprendre par les sanctions ou le blocage des loyers.</p>
        <div className="bg-red/5 p-4 rounded-xl border border-red/10">
          <p className="text-xs text-red font-semibold uppercase tracking-wider mb-2">Rappel important</p>
          <ul className="list-disc pl-4 text-xs text-red/80 space-y-1">
            <li>Classe G : Interdiction de louer depuis 2025</li>
            <li>Classe F : Interdiction dès 2028</li>
            <li>Classe E : Interdiction dès 2034</li>
          </ul>
        </div>
        <p><strong>Notre conseil :</strong> Profitez des aides MaPrimeRénov&apos; pour effectuer des travaux d&apos;isolation par l&apos;extérieur ou changer votre système de chauffage. Un bon DPE augmente la valeur verte de votre bien de 5 à 15%.</p>
      </div>
    )
  },
  {
    id: "financement-2026",
    title: "Obtenir un crédit immobilier en 2026 : ce qui a changé",
    category: "Financement",
    type: "actu",
    date: "8 Avr.",
    icon: Landmark,
    color: "text-[#60A5FA]",
    content: (
      <div className="space-y-4">
        <p>Les conditions d&apos;accès au crédit immobilier ont évolué en 2026. Voici ce que tout investisseur LMNP doit savoir avant de solliciter une banque :</p>
        <div className="space-y-3">
          <div className="bg-bg p-3 rounded-xl border border-border">
            <h4 className="font-bold text-sm text-[#60A5FA]">Taux d&apos;endettement à 35 %</h4>
            <p className="text-xs text-text-secondary mt-1">Le HCSF maintient la limite à 35 % des revenus nets. L&apos;astuce : en LMNP réel, vos loyers nets d&apos;amortissements peuvent être intégrés différemment selon les banques.</p>
          </div>
          <div className="bg-bg p-3 rounded-xl border border-border">
            <h4 className="font-bold text-sm text-[#60A5FA]">La banque regarde votre cashflow</h4>
            <p className="text-xs text-text-secondary mt-1">De plus en plus d&apos;établissements analysent le cashflow net réel de vos biens existants. Un bon dossier présentera un cashflow positif ou proche de zéro.</p>
          </div>
          <div className="bg-bg p-3 rounded-xl border border-border">
            <h4 className="font-bold text-sm text-[#60A5FA]">Apport et garanties</h4>
            <p className="text-xs text-text-secondary mt-1">Un apport de 10 à 20 % reste la norme. La caution Crédit Logement est souvent refusée pour l&apos;investissement locatif : l&apos;hypothèque ou le PPD sont privilégiés.</p>
          </div>
        </div>
        <p className="text-xs text-text-muted italic">Conseil : préparez un dossier avec vos 3 derniers bilans LMNP et la projection Propfolio de votre cashflow net.</p>
      </div>
    )
  },
  {
    id: "strategie-multi-biens",
    title: "Stratégie multi-biens : comment scaler son patrimoine après 2 biens",
    category: "Fiscalité",
    type: "cours",
    date: "2 Avr.",
    icon: TrendingUp,
    color: "text-green",
    content: (
      <div className="space-y-4">
        <p>Vous avez 2 biens et vous voulez accélérer ? La stratégie à partir du 3ème bien est différente. Voici le chemin emprunté par les investisseurs expérimentés :</p>
        <ol className="list-decimal pl-5 space-y-3 text-sm">
          <li>
            <strong>Optimisez d&apos;abord l&apos;existant :</strong>
            <p className="text-xs text-text-secondary mt-1">Avant d&apos;acheter un 3ème bien, assurez-vous que le cashflow de vos 2 premiers est positif. Chaque €/mois de cashflow améliore votre capacité d&apos;emprunt.</p>
          </li>
          <li>
            <strong>Arbitrez entre surface et rendement :</strong>
            <p className="text-xs text-text-secondary mt-1">Un studio à 6 % net vaut mieux qu&apos;un T4 à 3,5 %. Pour scaler, priorisez le rendement sur la surface.</p>
          </li>
          <li>
            <strong>Envisagez la SCI à l&apos;IS à partir de 3 biens :</strong>
            <p className="text-xs text-text-secondary mt-1">La SCI à l&apos;IS permet l&apos;amortissement et une fiscalité maîtrisée. Elle facilite aussi la transmission. À étudier avec un notaire.</p>
          </li>
          <li>
            <strong>Diversifiez géographiquement :</strong>
            <p className="text-xs text-text-secondary mt-1">Ne concentrez pas tout dans la même ville. Un bien en région à fort rendement complète bien un bien en grande ville plus sécurisé.</p>
          </li>
        </ol>
        <div className="bg-accent/5 p-3 rounded-xl border border-accent/10 text-xs text-text-secondary">
          Les calculs fiscaux sont indicatifs. Consultez un expert-comptable avant toute structuration.
        </div>
      </div>
    )
  }
];
