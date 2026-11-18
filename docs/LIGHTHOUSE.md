# Accessibilité, Lighthouse et SEO — Breach Academy

Cible : **WCAG 2.2 niveau AA**. Deux outils complémentaires :

| Outil | Quand | Ce qu'il couvre |
|---|---|---|
| Lighthouse 13.5.0 (`npm run lighthouse`) | à la main, avant/après | scores accessibilité, bonnes pratiques, SEO des pages publiques |
| axe-core dans Playwright (`e2e/accessibilite.e2e.ts`) | **à chaque push (CI)** | règles WCAG 2.0 → 2.2 A/AA, y compris sur des états que Lighthouse ne voit pas : niveau réussi, mode sécurisé, niveau 2 déverrouillé, page 404 |

Lighthouse s'appuie lui-même sur axe-core, mais n'audite qu'une URL chargée à
froid par un joueur neuf : il ne voit ni les niveaux verrouillés ni les états
après interaction. Le test E2E joue le parcours avant d'auditer.

## Lancer l'audit

```bash
npm run build
npm run preview            # autre terminal (NODE_ENV=development pour le HTTP local)
npm run lighthouse         # mobile simulé ; `npm run lighthouse -- http://localhost:3000 desktop`
npm run test:e2e           # inclut l'audit axe WCAG 2.2 AA
```

## Avant (build du 18/11/2026, mobile simulé)

| Route | Accessibilité | Bonnes pratiques | SEO |
|---|---|---|---|
| / | 100 | 100 | 90 |
| /niveaux/recherche-bavarde | 100 | 100 | 90 |
| /classement | 100 | 100 | 90 |
| /classement/ssr | 96 | 100 | 90 |
| /fiches | 100 | 100 | 90 |
| /fiches/csrf | 100 | 100 | 90 |

axe-core (WCAG 2.2 AA) trouvait en plus :

| Règle | Gravité | Où | Critère WCAG |
|---|---|---|---|
| `link-in-text-block` | sérieuse | lien « Choisissez un pseudonyme » du classement vide (`/classement/ssr`, **`/classement/csr`** — invisible pour Lighthouse, le tableau y arrive après le JS) | 1.4.1 Utilisation de la couleur |
| `link-in-text-block` | sérieuse | « Retour aux niveaux » de la **page 404** (Lighthouse refuse d'auditer une réponse 404) | 1.4.1 |
| `image-alt` | critique | niveau 1 après exploitation : c'est l'`<img src=x>` **du payload XSS**, contenu de l'attaquant → faux positif, le test recharge la page sans payload avant d'auditer | — |

## Corrections

- **Liens dans un bloc de texte soulignés** (`underline`) : classement vide,
  page 404, « Niveau suivant déverrouillé » / « Retour aux niveaux » de la page de
  niveau. La couleur seule ne suffit pas à distinguer un lien (WCAG 1.4.1).
- **Meta description** par défaut dans `index.html` (SEO, extrait des moteurs).
- **`public/robots.txt`** : site indexable, `/api/` exclu.

## Après (build du 18/11/2026, mobile simulé)

| Route | Accessibilité | Bonnes pratiques | SEO |
|---|---|---|---|
| / | 100 | 100 | 100 |
| /niveaux/recherche-bavarde | 100 | 100 | 100 |
| /classement | 100 | 100 | 100 |
| /classement/ssr | 100 | 100 | 100 |
| /fiches | 100 | 100 | 100 |
| /fiches/csrf | 100 | 100 | 100 |

Aucun audit Lighthouse en échec, et `e2e/accessibilite.e2e.ts` (axe, WCAG 2.2 AA)
ne trouve plus aucune violation sur les pages et états audités.

Limite : un 100 Lighthouse ne garantit pas la conformité WCAG. Les outils
automatiques ne détectent qu'une partie des critères (environ un tiers) :
navigation au clavier, ordre de lecture et pertinence des textes alternatifs
restent à vérifier à la main.

## Ce qui était déjà en place

Titres de page uniques (`RouteMeta.title`), `lang="fr"`, libellés de formulaire
(`<label for>`), zones `role="status"` / `role="alert"` pour les retours (flag,
erreurs), groupe `aria-labelledby` + `aria-pressed` pour le sélecteur de mode,
cibles tactiles ≥ 44 px (`min-h-11` / `min-h-12`, WCAG 2.5.8), contrastes du
thème sombre validés par Lighthouse.
