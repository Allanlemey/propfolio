# CLAUDE.md — Propfolio

## Projet
Propfolio est une web app de pilotage de patrimoine immobilier pour les investisseurs LMNP français.
Positionnement : "Le Finary de l'immobilier locatif".
URL : https://propfolio.fr

## Stack technique
- **Frontend** : Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend / BDD** : Supabase (PostgreSQL managé, Auth, Row Level Security)
- **Hébergement** : Vercel (connecté au repo GitHub)
- **Fonts** : DM Sans (body/UI) + Space Mono (chiffres, KPIs, données monétaires)
- **Icônes** : lucide-react
- **Thème** : dark mode par défaut, toggle dark/light

## Couleurs (DA)
### Dark mode
- Background : #0B0B1A
- Surface : #12122A
- Card : #1A1A3E
- Border : #2A2A5A
- Text : #E8E8F0
- Text secondary : #8888AA
- Text muted : #5A5A7A
- Accent (violet) : #6C63FF
- Green : #00D9A6
- Red : #FF6B6B
- Yellow : #FBBF24
- Gradient signature : linear-gradient(135deg, #6C63FF 0%, #00D9A6 100%)

### Light mode
- Background : #F5F3FF
- Surface : #FFFFFF
- Card : #FFFFFF
- Border : #E5E3F0
- Text : #1A1A2E
- Text secondary : #6B7280
- Text muted : #9CA3AF
- Accent : #6C63FF (identique)
- Green : #059669
- Red : #DC2626

## Design principles
- Inspiré de Finary : premium, épuré, "screenshotable"
- Chaque écran doit donner envie de faire une capture d'écran
- Les chiffres importants (KPIs, cashflow, scores) sont en Space Mono bold, grande taille
- Les montants positifs sont en vert, négatifs en rouge
- Cards avec border-radius 16px, shadow subtile, barre colorée en haut (3px)
- Bottom nav bar fixe avec 5 onglets : Dashboard, Mes biens, Simuler, Alertes, Profil

## Architecture des pages
```
/app
  /layout.tsx          → Layout global (ThemeProvider, fonts, bottom nav)
  /page.tsx            → Redirect vers /dashboard ou /onboarding
  /onboarding/         → 3 slides d'onboarding
  /auth/               → Connexion / Inscription (email + Google OAuth)
  /dashboard/          → WOW #1 — Dashboard patrimoine net (4 KPIs + courbe + liste biens)
  /biens/              → Liste des biens (état vide + cards)
  /biens/[id]/         → WOW #2 — Fiche bien détaillée (score /100, cashflow, crédit)
  /biens/nouveau/      → Formulaire d'ajout de bien (4 étapes)
  /simulation/         → WOW #3 — Simulation d'acquisition (sliders + résultats temps réel)
  /profil/             → Paramètres, régime fiscal, notifications, compte
```

## Base de données (Supabase PostgreSQL)
Tables principales :
- **users** : id, email, name, tax_regime, tax_bracket, created_at
- **properties** : id, user_id, name, address, type, surface, purchase_price, purchase_date, current_value, photo_url, regime
- **loans** : id, property_id, amount, rate, duration_years, monthly_payment, start_date, remaining_capital
- **charges** : id, property_id, type (taxe_fonciere/copro/pno/gli/travaux), amount, frequency
- **revenues** : id, property_id, monthly_rent, vacancy_rate
- **simulations** : id, user_id, name, params (jsonb), results (jsonb), created_at

RLS activé sur toutes les tables : chaque user ne voit que ses propres données.

## Calcul du cashflow (CRITIQUE — ne jamais simplifier)
```
Cashflow net réel mensuel =
  + Loyer charges comprises
  − Mensualité crédit (capital + intérêts)
  − Taxe foncière (÷ 12)
  − Charges de copropriété
  − Assurance PNO
  − Assurance GLI
  − Provision vacance locative
  − Provision travaux
  − Impôt sur revenus locatifs (selon régime)
  = CASHFLOW NET RÉEL
```
Toujours afficher aussi le cashflow brut (avant impôts et provisions) pour comparaison.

## Régimes fiscaux pris en charge (MVP)
1. **LMNP micro-BIC** : abattement 50% (ou 30% si non classé), seuil 77 700€
2. **LMNP réel simplifié** : déduction charges réelles + amortissements
3. **Location nue micro-foncier** : abattement 30%, seuil 15 000€
4. **Location nue régime réel** : déduction charges réelles

Mention obligatoire : "Les calculs fiscaux sont indicatifs. Consultez un expert-comptable."

## Score investissement /100
Calculé à partir de 5 critères :
- Rendement net (pondération 25%)
- Cashflow net (pondération 25%)
- Taux d'occupation (pondération 20%)
- Valorisation du bien (pondération 15%)
- Qualité emplacement (pondération 15%)

Couleurs : ≥75 = vert, ≥50 = violet, ≥30 = jaune, <30 = rouge

## Monétisation — Freemium
- **Gratuit** : 1 bien, dashboard basique, cashflow brut, 1 simulation
- **Premium 9€/mois** : biens illimités, cashflow NET (fiscalité), projections 10 ans, score /100, export image, simulations illimitées, notifications
- **Annuel 79€/an** : tout le premium, 2 mois offerts

## Conventions de code
- TypeScript strict
- Components dans /components, organisés par feature
- Hooks custom dans /hooks
- Utils (calculs, formatage) dans /lib
- Toujours utiliser les CSS variables pour les couleurs du thème
- Les composants UI réutilisables dans /components/ui
- Nommage des fichiers : kebab-case
- Nommage des composants : PascalCase
- Langue de l'UI : français
- Langue du code (variables, comments) : anglais

## Commandes utiles
```bash
npm run dev        # Lancer le serveur de dev (localhost:3000)
npm run build      # Build de production
npm run lint       # Linter
```

## Contexte business
- Cible : investisseurs immobiliers LMNP français (débutants + confirmés)
- Concurrents : Finary (trop généraliste), Horiz.io (UX datée), Ownily/LMNP.ai (compta/admin)
- Différenciation : cashflow NET réel avec fiscalité, design premium screenshotable, projection 10 ans
- Phase actuelle : MVP build + validation terrain en parallèle
