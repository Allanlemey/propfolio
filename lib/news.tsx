import { GraduationCap, PlayCircle, Building, LucideIcon } from "lucide-react";

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
  }
];
