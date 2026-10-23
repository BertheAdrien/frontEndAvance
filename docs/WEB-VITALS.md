# Web Vitals : classement en CSR, SSR et SSG

Le même classement est servi par trois routes ; seul le mode de rendu change.

| Route | Rendu | Comment |
|---|---|---|
| `/classement/csr` | Côté client | `routeRules: { ssr: false }` (`vite.config.ts`) : le serveur renvoie le gabarit vide, Angular démarre puis appelle `GET /api/classement`. |
| `/classement/ssr` | Côté serveur, à chaque requête | `load` dans `ssr.server.ts` : le HTML contient le classement à jour, puis Angular hydrate. |
| `/classement/ssg` | Pré-rendu au build | `prerender.routes` (`vite.config.ts`) : fichier statique `dist/analog/public/classement/ssg/index.html`, figé au moment du build. |

Chaque page affiche ses propres mesures (TTFB, FCP, LCP, CLS), relevées dans le
navigateur par la bibliothèque `web-vitals` (`src/app/leaderboard/web-vitals-panel.ts`).
Les liens entre les trois versions sont des liens classiques (`href`) et non des
`routerLink` : une navigation Angular ne recharge pas le document, donc ne referait
ni le rendu serveur ni la mesure.

## Reproduire la mesure

```bash
npm run build
PORT=3000 npm run preview            # terminal 1
npm run web-vitals                   # terminal 2 : mobile simulé, 3 passes
npm run web-vitals -- http://localhost:3000 3 desktop
```

Le script `scripts/web-vitals-lighthouse.mjs` lance Lighthouse 13.5.0 (via `npx`,
Chrome requis) sur chaque route et affiche la médiane des passes en Markdown.
À la main : DevTools › Lighthouse › catégorie « Performance », sur chaque route,
en navigation privée (sans extensions).

## Résultats (23/10/2026, poste de dev, serveur buildé en local)

Mobile simulé (ralentissement réseau et processeur appliqué par Lighthouse) :

| Route | Score perf. | TTFB | FCP | LCP | CLS | TBT |
|---|---|---|---|---|---|---|
| /classement/csr | 75 | 2 ms | 3850 ms | 4184 ms | 0.088 | 70 ms |
| /classement/ssr | 77 | 27 ms | 3997 ms | 4122 ms | 0.009 | 88 ms |
| /classement/ssg | 81 | 2 ms | 3664 ms | 3664 ms | 0.013 | 67 ms |

Bureau :

| Route | Score perf. | TTFB | FCP | LCP | CLS | TBT |
|---|---|---|---|---|---|---|
| /classement/csr | 98 | 2 ms | 791 ms | 925 ms | 0.005 | 0 ms |
| /classement/ssr | 100 | 28 ms | 664 ms | 664 ms | 0.006 | 5 ms |
| /classement/ssg | 99 | 1 ms | 738 ms | 738 ms | 0.004 | 0 ms |

## Lecture

- **TTFB** : SSR est le seul à calculer la page à la demande (rendu Angular +
  requête SQLite), d'où ~27 ms contre 1–2 ms pour un fichier statique (SSG) ou le
  gabarit vide (CSR).
- **LCP** : en CSR, le tableau n'apparaît qu'après le JavaScript **et** l'appel
  à l'API ; c'est le plus mauvais sur les deux profils. SSR et SSG livrent le
  contenu dans le HTML. En mobile, SSG gagne nettement (~0,5 s) ; en bureau,
  l'écart SSR/SSG (~70 ms) est du même ordre que le bruit entre passes.
- **CLS** : le CSR décale la page quand le tableau remplace « Chargement… »
  (0,088 en mobile, proche du seuil de 0,1) ; SSR et SSG restent stables.
- **Fraîcheur** : le SSG affiche le classement de la base **au moment du build**
  (vide dans l'image Docker) ; un joueur qui choisit son pseudonyme apparaît en
  CSR et en SSR, pas en SSG avant le prochain build. C'est le coût du gain de
  performance ; une régénération périodique (ISR) serait la suite logique.

Limites : mesures sur `localhost` (pas de latence réseau réelle), base presque
vide, un seul poste. Les ordres de grandeur valent pour la comparaison, pas
comme valeurs absolues ; refaire la mesure sur le VPS pour l'oral.
