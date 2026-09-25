# Données de revente : état des accès gratuits

Vérification du 25 septembre 2026. Ce document distingue les connecteurs actifs des pistes étudiées ; une source citée ici n'est pas automatiquement surveillée.

## En production

- **Dealabs** : quatre flux RSS d'acquisition, dédupliqués. Les marchands cités dans les offres ne sont pas interrogés directement.
- **Rebuy France** : devis publics de reprise électronique, sous conditions. Ils ne mesurent ni un taux de vente entre particuliers, ni un délai de revente. L'éligibilité d'une activité d'achat-revente reste à confirmer auprès du repreneur.
- **Easy Cash** : connecteur présent mais HTTP 403 depuis GitHub Actions ; aucune preuve de prix n'est produite dans ce cas.

## Vérifications complémentaires

- **Jeux chez Rebuy** : la recherche publique de Pragmata n'a retourné aucune référence exploitable. Cela ne démontre pas une absence de demande sur les autres marchés. Ne pas fabriquer de référence ou réutiliser un prix de console pour un jeu.
- **Enceinte Bose SoundLink Plus** : une référence existe dans la recherche Rebuy, mais le résultat porte la mention « Pas d'achat ». Une page catalogue ne prouve donc pas qu'une reprise soit possible. Les indicateurs de disponibilité de reprise doivent continuer à être exigés.
- **Momox** : les pages officielles décrivent des estimations de rachat de jeux par code-barres. Cependant, la lecture HTTP de `https://www.momox.fr/vendre-jeux-video/` a répondu 403 dans l'environnement de développement. Aucun connecteur n'est ajouté et aucun contournement n'est tenté. Il faudrait également obtenir et vérifier l'EAN exact des offres, les conditions de reprise et l'accès automatisé avant intégration.
- **Descriptions Dealabs des téléphones sans couleur précise** : les exemples Pixel 10a et Galaxy A57 contiennent plusieurs variantes ou une liste de caractéristiques générale. Ils ne permettent pas de déduire une variante unique ; ne pas prendre arbitrairement la première couleur ou capacité mentionnée.

## Piste pour mesurer les ventes réelles

L'outil [Recherche de produits eBay](https://www.ebay.fr/help/selling/selling-tools/terapeak?id=4853) est gratuit pour les vendeurs ayant accès au Hub vendeur. Il fournit notamment les prix de ventes réalisées et un taux de vente sur des périodes allant jusqu'à 90 jours. Il peut permettre une validation de marché via l'interface officielle si l'utilisateur y a accès.

Cela **ne constitue pas un accès API** : la [documentation développeur eBay](https://www.developer.ebay.com/api-docs/buy/static/ref-buy-browse-filters.html) indique que Marketplace Insights est restreinte et fermée aux nouveaux utilisateurs. Un compte vendeur ou développeur ne suffit pas à débloquer ce flux. Aucune donnée derrière une session privée ne doit être publiée dans le dépôt public sans autorisation appropriée.

Prochaine décision : vérifier avec l'utilisateur s'il possède déjà l'accès au Hub vendeur. Cette vérification peut aider à contrôler des comparaisons réelles, mais ne doit pas être présentée comme une automatisation acquise. L'intégration horaire de ventes conclues reste non résolue. Aucun abonnement payant, compte ou transaction n'a été créé.
