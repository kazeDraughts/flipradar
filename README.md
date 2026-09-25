# FlipRadar

Site : https://kazedraughts.github.io/flipradar/

État au 25 septembre 2026 : GitHub Pages, la collecte Dealabs et les références de rachat Rebuy fonctionnent sur GitHub Actions. Aucun abonnement payant. La recherche automatique élargit désormais le catalogue aux modèles reconnus dans les offres ; le diagnostic publié affiche la couverture réellement obtenue à chaque scan. Les devis Easy Cash répondent en local mais renvoient HTTP 403 depuis GitHub ; ils restent indisponibles dans la veille hébergée. Zéro opportunité qualifiée ne prouve pas l'absence de bonnes affaires parmi les offres non couvertes.

Radar d’achat-revente en France, neuf prioritaire, budget de 1 000 € par achat. Les données affichées viennent de recherches datées, pas d’un jeu de démonstration.

## Ce qui fonctionne

- Lecture de quatre flux RSS publics Dealabs et déduplication des offres.
- Exclusion des bons d’achat, promotions conditionnelles repérées, offres anciennes, lots et catégories hors cible.
- Lecture de prix de reprise Rebuy pour quatre références explicites et découverte automatique de modèles reconnus ; connecteur Easy Cash présent mais bloqué depuis GitHub.
- Simulation achat + transport entrant + frais de revente + transport sortant + provision de risque. Seuils par défaut : bénéfice 30 €, rendement sur coût 25 %.
- Tableau de bord, recherche, filtres, fiches sourcées et favoris locaux persistants.
- Workflow GitHub Actions horaire (minute 17), déclenchement manuel, publication GitHub Pages.
- Une issue avec mention du propriétaire par nouvelle opportunité qualifiée, sans répétition. Réception email selon les réglages GitHub du destinataire. Un test de réception peut être lancé depuis Actions.

## Couverture et limites actuelles

### Recherche automatique gratuite

Quatre flux Dealabs sont lus et dédupliqués : général, téléphonie, consoles/jeux vidéo et high-tech. Ils couvrent davantage d'offres que les seules 30 dernières du flux général, mais ne représentent pas une surveillance directe ni exhaustive des marchands.

Le radar sait rechercher une nouvelle référence Rebuy sans entrée manuelle pour les familles suivantes : Samsung Galaxy S/A/Z, Apple iPhone, Google Pixel et casques/écouteurs Sony WH/WF-1000XM. Il exige un modèle reconnu, une seule capacité de stockage pour les téléphones et une couleur reconnue. Les variantes imprécises, les accessoires, les titres à choix multiples et les résultats ambigus ne sont pas retenus. La fiche produit est ensuite relue pour confirmer le titre, l'identifiant et le prix de rachat disponible. Une correspondance de titre ne certifie pas la version régionale ni l'état réel ; ces limites figurent dans la fiche.

Au maximum `maximumDiscoveryQueries` recherches distinctes (10 par scan) sont effectuées, en donnant priorité aux offres récentes. Les offres différées ou non reconnues restent à vérifier, sans marge inventée. Les reprises, ODR et avantages réservés repérés sont exclus du prix cash. Aucun compte Rebuy, abonnement ni vente automatique n'est créé.

Le diagnostic distingue une panne de collecte, une panne de comparaison et une couverture insuffisante. Le site affiche combien d'offres actuelles disposent réellement d'une comparaison vérifiée. Zéro opportunité rentable n'est pas une conclusion valable lorsque les comparaisons sont indisponibles.

Le scan renvoie le code 2 si la collecte échoue, 3 si aucune comparaison de marché actuelle n'est disponible, et 4 si son résultat est périmé. Le workflow publie d'abord ce diagnostic, puis signale l'échec : un flux Dealabs fonctionnel ne suffit plus à afficher une exécution réussie. Les preuves périmées, non concordantes ou insuffisantes ne produisent aucun chiffre de bénéfice.

L'intégration de ventes réalisées reste à débloquer avec une source autorisée. Recherche du 25 septembre 2026 : l'accès aux ventes réalisées via l'API eBay est restreint ([réponse du support eBay](https://community.ebay.com/forum/ebay-developers-program-57950/topic/approved-method-for-accessing-soldcompleted-listing-data-for-sell-through-research-468863/)) ; PriceCharting exige une autorisation pour diffuser ses données dans une application accessible à des tiers ([conditions](https://www.pricecharting.com/page/terms-of-service)). Aucun abonnement ni contournement de blocage n'a été mis en place. Ces services ne sont pas connectés.

Dealabs est la source des offres : les marchands cités ne sont pas surveillés directement. Les reprises professionnelles sont des estimations conditionnelles, pas des engagements d’achat. Le catalogue comprend les DualSense blanches et bleues standard (Easy Cash), ainsi que quatre références Rebuy : Sony WH-1000XM5 noir, Switch OLED blanche standard, AirPods Pro 2 USB-C complets et PS5 Slim disque 1 To CFI-2016. D’autres produits restent « À vérifier » tant qu’une correspondance exacte n’a pas été ajoutée. Les éditions spéciales et accessoires sont exclus des correspondances standard ; la PS5 exige une référence de châssis explicite.

Rebuy : lecture du tarif public de rachat A1 (« comme neuf »), en centimes EUR, avec vérification de l'identifiant, du titre et des indicateurs de reprise disponible. Ce n'est ni le prix de vente du magasin, ni le bon d'achat, ni un historique de ventes conclues. Le montant de base PS5 Slim a été vérifié via le questionnaire public le 25/09/2026, sans ajouter de produit au panier. Les tarifs sont relus à chaque scan, sans abonnement. Les accessoires doivent être complets ; le questionnaire final, l'état réel et les conditions d'éligibilité peuvent modifier la reprise. Une réserve de transport sortant est conservée par prudence.

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
