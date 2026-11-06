# DESIGN.md — GoodDoctor's Shop

> Design system documenté du site e-commerce GoodDoctor's Shop.
> Référence pour tout agent ou développeur travaillant sur l'interface.

---

## 1. Palette de couleurs

| Token | Valeur | Usage |
|---|---|---|
| `--color-ink` | `#242722` | Texte principal |
| `--color-ink-muted` | `#5c6058` | Texte secondaire, descriptions |
| `--color-ink-subtle` | `#7d8075` | Texte tertiaire, labels, placeholders |
| `--color-paper` | `#faf9f6` | Fond de page |
| `--color-surface` | `#f2f1ec` | Fond de cartes, sections alternées |
| `--color-border` | `#dedfd8` | Bordures principales |
| `--color-border-subtle` | `#eeede8` | Bordures légères, séparateurs |
| `--color-accent` | `#087fb5` | CTA, liens, focus ring |
| `--color-accent-hover` | `#066a98` | CTA hover |
| `--color-accent-light` | `#e0f2fe` | Badge fond, sélection texte |
| `--color-success` | `#15803d` | Confirmations, stock |
| `--color-error` | `#dc2626` | Erreurs, alertes |
| `--color-promo` | `#c2410c` | Prix promo, badges promo |
| `--color-white` | `#ffffff` | Fonds blancs, texte sur sombre |
| `--color-ink-strong` | `#0f172a` | Texte emphase forte (slate-900) |
| `--color-ink-secondary` | `#1e293b` | Texte secondaire sombre (slate-800) |
| `--color-ink-tertiary` | `#475569` | Labels, métadonnées (slate-600) |
| `--color-ink-placeholder` | `#64748b` | Placeholders, texte discret (slate-500) |
| `--color-surface-light` | `#f1f5f9` | Fonds légers, inputs (slate-100) |
| `--color-surface-card` | `#f8fafc` | Fonds de cartes détail (slate-50) |
| `--color-border-input` | `#cbd5e1` | Bordures d'inputs (slate-300) |
| `--color-border-card` | `#e2e8f0` | Bordures de cartes (slate-200) |

### Palette tracking (zinc)

| Token | Valeur | Usage |
|---|---|---|
| `--color-track-ink` | `#09090b` | Texte principal tracking |
| `--color-track-ink-secondary` | `#18181b` | Texte secondaire tracking |
| `--color-track-ink-muted` | `#27272a` | Texte atténué |
| `--color-track-ink-subtle` | `#52525b` | Labels |
| `--color-track-ink-faded` | `#71717a` | Texte discret |
| `--color-track-ink-ghost` | `#a1a1aa` | Texte fantôme |
| `--color-track-surface` | `#fafafa` | Fond tracking |
| `--color-track-surface-alt` | `#f4f4f5` | Fond alterné |
| `--color-track-border` | `#e4e4e7` | Bordures tracking |
| `--color-track-border-muted` | `#d4d4d8` | Bordures légères |

**Tonalité** : Vert olive naturel + bleu médical. Pas de gris pur, toujours une teinte chaude olive.

---

## 2. Typographie

| Token | Valeur | Usage |
|---|---|---|
| `--font-sans` | `'DM Sans', sans-serif` | Corps de texte, UI |
| `--font-display` | `'Manrope', sans-serif` | Titres h1-h3 |

**Tailles clés** :
- h1 : `clamp(1.75rem, 4vw, 2.5rem)` — display, hero
- h2 : `clamp(1.5rem, 3vw, 2rem)` — titres de section
- Body : `15px` — taille de base
- Small : `13px` — badges, labels, métadonnées

**Poids** : 400 (body), 500 (semi-bold labels), 600 (sous-titres), 700 (headings), 800 (hero h1)

**Prix** : `font-variant-numeric: tabular-nums` — alignement des chiffres

---

## 3. Échelle de rayons

| Token | Valeur | Usage |
|---|---|---|
| `--radius-sm` | `4px` | Badges, tags |
| `--radius-md` | `8px` | Inputs, boutons secondaires |
| `--radius-lg` | `12px` | Cartes produit |
| `--radius-xl` | `16px` | Modales, drawers |
| `--radius-full` | `9999px` | Pilules, avatars |

---

## 4. Courbes d'animation (Emil Kowalski)

| Token | Valeur | Usage |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | Entrées UI, apparitions |
| `--ease-in-out` | `cubic-bezier(0.77, 0, 0.175, 1)` | Transitions symétriques |
| `--ease-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` | Ouvertures rapides (searchbar, drawers) |

**Durées de référence** :
- Micro-feedback (hover, :active) : `120-200ms`
- Entrées UI (cartes, searchbar) : `250-400ms`
- Modales/drawers : `200-250ms`
- Stagger inter-carte : `50ms`

---

## 5. Z-index

| Token | Valeur |
|---|---|
| `--z-dropdown` | `10` |
| `--z-sticky` | `20` |
| `--z-overlay` | `30` |
| `--z-modal` | `40` |
| `--z-toast` | `50` |
| `--z-lightbox` | `60` |

---

## 6. Points de rupture

| Nom | Valeur | Usage |
|---|---|---|
| Mobile | `max-width: 640px` | Layout une colonne |
| Desktop | `min-width: 641px` | Layout multi-colonnes |

Un seul breakpoint unifié à `640px`. Pas de tablette intermédiaire.

---

## 7. Composants principaux

### Cartes produit (`.product.modern-card`)
- Fond : `--color-surface`
- Rayon : `--radius-lg`
- Image : ratio aspect-ratio, `object-fit: cover`
- Hover image : `scale(1.035)` gated `@media (hover: hover) and (pointer: fine)`
- Badge promo : fond `--color-promo`, texte blanc
- Bouton « Ajouter » : fond `--color-ink`, texte blanc

### Header
- Fond : `--color-paper` avec `backdrop-filter: blur(12px)` 
- Position : sticky top 0
- Logo : `--font-display`, weight 800

### Drawer / Modal (via `ModalShell.tsx`)
- Overlay : fond semi-transparent, `animation: overlay-enter`
- Drawer : slide depuis la droite, `animation: drawer-enter`
- Exit animé : classe `.closing` → animations de sortie (`overlay-exit`, `drawer-exit`)
- Fermeture : clic overlay + touche Escape → les deux déclenchent l'animation de sortie

### Searchbar
- Entrance : `animation: searchbar-slide-down 0.18s --ease-expo`
- Input : `border-radius: --radius-full`, bordure `--color-border`

### Newsletter
- Section pleine largeur, fond `--color-surface`
- Input + bouton inline
- Spinner de chargement : `@keyframes nl-spin`

### WhatsApp flottant
- Position fixed, bas-droite
- Pulse limité à 3 itérations (pas infini)

---

## 8. Animations & motion

### Catalogue des animations actives

| Nom | Keyframe | Durée | Élement |
|---|---|---|---|
| Hero entrance | `gentle-rise` | `650ms` | `.hero-content` |
| Cartes produit stagger | `gentle-rise` | `400ms` + delay 0-250ms | `.product-grid > .product` |
| Searchbar slide | `searchbar-slide-down` | `180ms` | `.searchbar` |
| Overlay entrée | `overlay-enter` | `200ms` | `.overlay` |
| Drawer entrée | `drawer-enter` | `250ms` | `.drawer` |
| Overlay sortie | `overlay-exit` | `200ms` | `.overlay.closing` |
| Drawer sortie | `drawer-exit` | `200ms` | `.drawer.closing` |
| Toast entrée | `toast-slide-up` | `300ms` | `.share-toast` |
| WA pulse | `waPulse` | 3 itérations | `.floating-whatsapp-pulse` |
| Marquee | `marquee-scroll` | `30s` linear | `.marquee-track` |
| Favori badge | `favBadgePop` | feedback | `.favorite.liked` |
| Tracking page | `gentle-rise` | `400ms` | `.tracking-page` |
| Empty state | `gentle-rise` | `400ms` | `.empty` |

### Reduced motion
Deux blocs `@media (prefers-reduced-motion: reduce)` :
1. **Bloc haut** (L665) : scroll-behavior auto, marquee arrêté en grille statique, hero et WA pulse coupés
2. **Bloc bas** (section 9) : cartes, overlay/drawer, toasts, searchbar, empty, tracking → `animation: none; opacity: 1`

### Règles motion
- Hover gated derrière `@media (hover: hover) and (pointer: fine)`
- Marquee pausable au hover
- Jamais `transition: all` — toujours propriétés spécifiques
- Jamais `scale(0)` — minimum `scale(0.97)`
- Toujours `:active` scale sur les boutons interactifs

---

## 9. Architecture CSS

### Fichiers
| Fichier | Rôle |
|---|---|
| `src/index.css` | Import Tailwind + @theme tokens + `@layer base-styles` (styles desktop) + keyframes globaux + lightbox |
| `src/polish.css` | Couche de polish non-layered (gagne la cascade sur `base-styles`) |
| `src/product-cards.css` | Styles cartes produit, badges, prix |
| `src/tracking.css` | Page de suivi de commande |
| `src/legal-pages.css` | Pages légales (CGV, mentions) |

### Cascade
- `@layer base-styles` dans `index.css` : styles fondamentaux
- `polish.css` hors layer : priorité naturelle sans `!important`
- `!important` : réservé aux overrides légitimes (lightbox themes, badges prix, `prefers-reduced-motion`)

---

## 10. Accessibilité

- **Focus ring** : `2px solid --color-accent`, offset `3px`, sur `:focus-visible`
- **Caret** : couleur `--color-accent` sur tous les inputs
- **Contraste WCAG AA** : tous les textes vérifiés (ink/paper 15.8:1, ink-muted/paper 5.5:1, ink-subtle/paper 4.5:1)
- **Sélection texte** : fond `--color-accent-light`, texte `--color-ink`
- **Inputs mobile** : `font-size: 16px` pour éviter le zoom Safari
- **Boutons touch** : add-to-cart toujours visible sur `(hover: none)` et `(max-width: 900px)`
- **ARIA** : `aria-label` sur favoris, partage, recherche ; `aria-expanded` sur toggle search
