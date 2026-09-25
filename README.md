# FlipRadar

Radar d’achat-revente en France, neuf prioritaire, budget de 1 000 € par achat. Les données affichées viennent de recherches datées, pas d’un jeu de démonstration.

## Ce qui fonctionne

- Lecture du flux RSS public Dealabs et déduplication des offres.
- Exclusion des bons d’achat, promotions conditionnelles repérées, offres anciennes, lots et catégories hors cible.
- Lecture de prix de reprise Easy Cash pour les références explicitement configurées.
- Simulation achat + transport entrant + frais de revente + transport sortant + provision de risque. Seuils par défaut : bénéfice 30 €, rendement sur coût 25 %.
- Tableau de bord, recherche, filtres, fiches sourcées et favoris locaux persistants.
- Workflow GitHub Actions horaire (minute 17), déclenchement manuel, publication GitHub Pages.
- Une issue avec mention du propriétaire par nouvelle opportunité qualifiée, sans répétition. Réception email selon les réglages GitHub du destinataire. Un test de réception peut être lancé depuis Actions.

## Couverture et limites actuelles

Dealabs est la source des offres : les marchands cités ne sont pas surveillés directement. Les reprises Easy Cash sont des estimations conditionnelles, pas des engagements d’achat. Le catalogue de comparaison initial couvre les DualSense blanches et bleues standard. D’autres produits restent « À vérifier » tant qu’un connecteur ou une correspondance exacte n’a pas été ajouté. Les éditions spéciales et accessoires sont exclus des correspondances standard.

eBay et Leboncoin sont proposés comme liens de recherche manuelle : leurs annonces ne sont pas collectées automatiquement. L’accès HTTP aux ventes terminées eBay a répondu 403 pendant le développement. Le moteur peut traiter des ventes conclues documentées, mais aucun flux automatisé de ventes conclues n’est encore connecté. Une popularité sur Dealabs ou un prix affiché n’est jamais considéré comme une vente.

Les alertes peuvent être désactivées avec `alertsEnabled`. Les filtres du navigateur ne modifient pas la configuration de la veille. Les prix et les observations du dépôt sont publics ; aucun secret ni email personnel n’y est stocké.

## Exécuter

Node.js 22 ou plus récent :

```sh
npm ci --ignore-scripts
npm test
npm run scan
npm run serve
```

Ouvrir http://127.0.0.1:4173. Ne pas ouvrir directement le fichier HTML : le navigateur doit charger les données JSON par HTTP.

## Publication et emails

Dans Settings → Pages, sélectionner GitHub Actions. Le workflow publie uniquement `public/`. Il lit les sources, exécute les tests et conserve les observations sur `main`. La planification GitHub peut subir des retards ; le site signale une collecte vieille de plus de 3 heures.

Dans GitHub → Settings → Notifications, activer les emails pour « Participating and @mentions » si souhaité. Le workflow mentionne le propriétaire via une issue. L’option `test_alert` dans « Run workflow » crée un test identifiable et dédupliqué. La création de l’issue prouve l’envoi de la notification à GitHub, pas sa livraison dans une boîte email.

## Ajouter une référence de comparaison

Dans `config.json`, ajouter à `productMappings` la référence, les mots indispensables (synonymes possibles par tableau), les variantes exclues, les mots attendus dans le titre du devis et l’URL publique exacte Easy Cash. Vérifier modèle, capacité, couleur, région et accessoires. Les prix expirent après 24 heures. Les quotes sans titre concordant, prix unique ou marché EUR/France sont refusées.

Le calcul est une aide à la décision : stock et conditions à confirmer avant achat ; fiscalité et temps de travail non inclus. Ne pas confondre rendement sur coût et marge sur chiffre d’affaires.
