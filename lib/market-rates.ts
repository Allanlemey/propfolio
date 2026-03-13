export type BankRate = {
  bank: string;
  rate15: string;
  rate20: string;
  rate25: string;
  trend: "up" | "down" | "stable";
  logo?: string;
  description?: string;
};

export const MARKET_RATES: BankRate[] = [
  { 
    bank: "Meilleur taux", 
    rate15: "3,45", 
    rate20: "3,60", 
    rate25: "3,75", 
    trend: "down",
    description: "Courtier leader du marché, propose souvent les meilleures offres négociées."
  },
  { 
    bank: "BoursoBank", 
    rate15: "3,35", 
    rate20: "3,55", 
    rate25: "3,70", 
    trend: "down",
    description: "Banque en ligne avec des frais réduits et un parcours 100% digital."
  },
  { 
    bank: "BNP Paribas", 
    rate15: "3,55", 
    rate20: "3,70", 
    rate25: "3,85", 
    trend: "stable",
    description: "Acteur historique avec un accompagnement personnalisé en agence."
  },
  { 
    bank: "Crédit Agricole", 
    rate15: "3,50", 
    rate20: "3,65", 
    rate25: "3,80", 
    trend: "down",
    description: "Banque mutualiste très active sur le prêt immobilier régional."
  },
  { 
    bank: "Société Générale", 
    rate15: "3,60", 
    rate20: "3,75", 
    rate25: "3,90", 
    trend: "stable",
    description: "Propose des solutions adaptées aux primo-accédants."
  },
  { 
    bank: "LCL", 
    rate15: "3,52", 
    rate20: "3,68", 
    rate25: "3,82", 
    trend: "down",
    description: "Des offres compétitives pour les dossiers à fort apport."
  },
];
