# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Professionnels de santé au Togo et en Afrique de l'Ouest — médecins, infirmier(e)s, chirurgien(ne)s, pharmacien(ne)s, laborantin(e)s — qui cherchent des uniformes et équipements médicaux de qualité certifiée livrés à Lomé et environs. L'achat se fait typiquement depuis un mobile, souvent avec une connexion variable.

## Product Purpose

Vendre en ligne des uniformes médicaux (blouses, tenues chirurgicales, sabots) et des dispositifs médicaux de luxe. Le site remplace le déplacement en boutique : le professionnel voit le catalogue, filtre par catégorie, consulte les détails (tailles, couleurs, variantes), ajoute au panier et passe commande via CashPay (paiement mobile adapté à la région).

Succès = un professionnel de santé trouve, commande et reçoit son équipement sans friction.

## Positioning

Positionnement luxe et certifié dans un marché où les alternatives sont des importations non-certifiées ou des marchés physiques sans garantie. GoodDoctor's Shop offre des produits certifiés, des photos détaillées multi-vues, et un paiement sécurisé par CashPay.

## Operating Context

- Commande en ligne → livraison locale à Lomé
- Paiement via CashPay (mobile money, intégration serverless via Netlify Functions)
- Suivi de commande intégré
- Pas de compte utilisateur requis (commande en tant qu'invité)
- Le site affiche les prix en FCFA

## Capabilities and Constraints

- Catalogue dynamique via API Netlify Functions (`/api/products`)
- Paiement sécurisé : payload chiffré JWE (RSA-OAEP-256 + A256GCM), proxy serverless
- Base de données Supabase (PostgreSQL) pour les produits et commandes
- Aucune clé secrète côté navigateur
- Galeries multi-images avec zoom lightbox
- Filtrage par catégorie (Blouses, Chirurgie, Sabots, Dispositifs, Accessoires)
- Favoris (stockage local)
- Responsive mobile-first (breakpoint 640px)
- Pas de système d'authentification utilisateur

## Brand Commitments

- Nom : **GoodDoctor's Shop**
- Tagline implicite : qualité certifiée pour les professionnels de santé
- Palette : tons olive/sauge (#242722 ink) + accent bleu médical (#087fb5)
- Typographie : DM Sans (corps) + Manrope (titres)
- Ton : professionnel, sobre, fiable — pas de langage marketing agressif
- Logo textuel (pas d'image de logo actuellement)

## Evidence on Hand

- Photos produits réelles (hébergées, visibles dans le catalogue)
- Aucun témoignage client confirmé — ne pas en fabriquer
- Aucune certification affichée (numéros, labels) — ne pas inventer
- Prix réels en FCFA dans la base de données
- Carte de livraison Lomé intégrée (Google Maps)

## Product Principles

1. **Confiance d'abord** — chaque interaction doit renforcer la crédibilité : paiement sécurisé, photos réelles, prix clairs.
2. **Mobile sans compromis** — la majorité des visiteurs achètent depuis un téléphone ; chaque surface doit fonctionner sur un écran de 375px avec une connexion instable.
3. **Clarté transactionnelle** — le chemin de la découverte à l'achat est court et explicite ; pas de dark patterns, pas de friction superflue.
4. **Sobriété premium** — le luxe se manifeste par la retenue, pas par l'excès décoratif ; les animations servent la compréhension, pas l'exhibition.

## Accessibility & Inclusion

- WCAG AA minimum (contraste, focus-visible, prefers-reduced-motion)
- Textes en français
- Touch targets ≥ 44px sur mobile
- Navigation clavier complète (Tab, Escape pour fermer les modales)
