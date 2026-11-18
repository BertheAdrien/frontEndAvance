# Breach Academy

CTF pédagogique (*Capture The Flag*) : chaque niveau est une faille web réelle,
jouable d'abord en **mode vulnérable** (on l'exploite pour récupérer un flag), puis
en **mode sécurisé** (la même attaque échoue, et un test automatisé le prouve).

Projet du TP « Front-end avancé », thème approfondi **Sécurité + Tests** : CSP,
gestion des secrets, XSS, CSRF ; tests unitaires, d'intégration et E2E ; TDD
assisté par IA (Claude Code).

| | |
|---|---|
| **Auteur** | Adrien Berthe ([@BertheAdrien](https://github.com/BertheAdrien)) |
| **Site en ligne** | https://breach-academy.bertadrien.fr (mode vulnérable activé : le jeu est jouable) |
| **IA utilisée** | Claude Code uniquement |
| **Méta-framework** | AnalogJS 2.9 (Angular 22) + TypeScript strict |
| **Interpréteur** | Node.js 24 LTS |

## Correspondance avec les attendus du TP

| Attendu | Réalisation | Où le vérifier |
|---|---|---|
| **Phase 1** — nom, IA, méta-framework, interpréteur, thématique | Tableau ci-dessus ; thème *Sécurité + Tests* | ce README, [`docs/IDEES.md`](docs/IDEES.md) |
| **Phase 2** — maquette Figma → interface fidèle et accessible | ⚠️ Pas de maquette Figma : l'interface a été conçue directement en code (Tailwind, thème sombre « terminal ») | — |
| Accessibilité testée avec Lighthouse | Lighthouse **100** en accessibilité, bonnes pratiques et SEO sur toutes les pages auditées ; audit axe WCAG 2.2 AA automatisé en E2E | [`docs/LIGHTHOUSE.md`](docs/LIGHTHOUSE.md), `e2e/accessibilite.e2e.ts` |
| Interpréteur ECMAScript | Node.js 24 LTS (dev, CI et image Docker `node:24-alpine`) | `Dockerfile`, `.github/workflows/ci.yml` |
| Méta-framework + TypeScript | AnalogJS (routage par fichiers, `load` serveur, SSR/SSG), TypeScript `strict` | `src/app/pages/`, `tsconfig.json` |
| Backend intégré pour une API simple | Routes **Nitro/h3** + SQLite : progression, flags, classement, API de chaque niveau | `src/server/routes/api/` |
| PWA | Service worker, fiches de cours **hors ligne**, notifications **Web Push** (désactivées sur le VPS faute de clés VAPID) | `vite.config.ts` (`VitePWA`), `public/push-sw.js` |
| **Phase 3** — une même page en CSR, SSR et SSG, comparaison des Web Vitals | Classement en 3 rendus, mesures affichées dans la page + comparatif Lighthouse | `/classement/csr`, `/classement/ssr`, `/classement/ssg`, [`docs/WEB-VITALS.md`](docs/WEB-VITALS.md) |
| Score Lighthouse selon WCAG 2.2 | Avant/après documenté (liens distingués autrement que par la couleur, meta description, `robots.txt`) | [`docs/LIGHTHOUSE.md`](docs/LIGHTHOUSE.md) |
| Tests unitaires, fonctionnels, end-to-end | **191 tests Vitest** (unitaires + intégration des routes API, **81,9 %** des lignes) ; **18 tests Playwright** (parcours joueur, attaques en mode vulnérable *et* sécurisé, accessibilité) ; tout tourne en CI | `src/**/*.spec.ts`, `e2e/`, section [Tests](#tests) |
| **Phase 4** — CSP | CSP posée par middleware Nitro, jouable en 3 politiques (aucune / *report-only* / bloquante) avec collecte des violations (niveau 3) | `src/server/levels/csp-wall.ts` |
| Gestion des secrets | Aucun secret dans Git : flags dérivés par HMAC de `FLAG_SECRET` à l'exécution, `.env` hors dépôt, gitleaks (pre-commit + CI), secret de prod généré sur le serveur ; niveau 5 consacré aux fuites de secrets | `.env.example`, `.githooks/pre-commit`, niveau 5 |
| Protections XSS | Niveaux 1 (réfléchie) et 2 (stockée) : interpolation Angular, validation Zod, cookie `HttpOnly` ; prouvé par les tests E2E | `e2e/attaques.e2e.ts` |
| Protections CSRF | Niveau 4 : `SameSite=Strict`, vérification d'`Origin`, jeton double-submit `XSRF-TOKEN` | `src/server/levels/bank.ts` |
| **Phase 5** — mise en production via Docker | Image multi-stage (utilisateur non root, FS en lecture seule, sans capacités), déployée sur un VPS derrière nginx + HTTPS Let's Encrypt | `Dockerfile`, [`docs/DEPLOIEMENT.md`](docs/DEPLOIEMENT.md) |

## Les niveaux

| # | Niveau | Faille | Correctif en mode sécurisé |
|---|---|---|---|
| 1 | Le moteur de recherche bavard | XSS réfléchie (`bypassSecurityTrustHtml`) | Interpolation Angular `{{ }}` |
| 2 | Le livre d'or | XSS stockée, vol d'un cookie non `HttpOnly` | Validation Zod, rendu texte, cookie `HttpOnly` |
| 3 | Le mur invisible | Absence de CSP | CSP aucune / *report-only* / bloquante, rapports de violation |
| 4 | Le virement fantôme | CSRF sur une fausse banque | `SameSite=Strict`, vérification d'`Origin`, jeton double-submit |
| 5 | Le coffre qui fuit | Secret dans le bundle et l'historique Git | Variables d'environnement, gitleaks |
| 6 | Le chatbot trop serviable | Injection de prompt directe et indirecte | Séparation données / instructions, filtrage de la sortie |

Le niveau N+1 se déverrouille avec le flag du niveau N. Chaque niveau a sa fiche de
cours (`/fiches/…`), consultable hors ligne. Les solutions sont dans
[`docs/SOLUTIONS.md`](docs/SOLUTIONS.md) (attention, *spoilers*).

> **Le code vulnérable ne s'active que si `BREACH_VULNERABLE_MODE=true`.** Il est
> marqué `// VULNERABLE (démo):` et ne touche que des faux services isolés (fausse
> banque, faux bot, chatbot simulé). La progression, l'API des flags et les sessions
> restent toujours sécurisées. Le chatbot est simulé : aucun appel à un LLM.

## Stack

- **AnalogJS 2.9** (Angular 22 + Vite 8), TypeScript strict, Tailwind CSS 4
- Backend : routes API **Nitro/h3** intégrées à Analog (`src/server/routes/api/`)
- Persistance : **SQLite** (fichier local, ignoré par Git)
- **Node.js 24 LTS**
- Tests : **Vitest** (unitaires + intégration, couverture v8), **Playwright**
  (E2E : parcours joueur, attaques en mode vulnérable / sécurisé, audit axe WCAG 2.2 AA)
- PWA : service worker (`vite-plugin-pwa`), fiches hors ligne, Web Push
- Déploiement : **Docker** multi-stage sur un VPS, derrière nginx (HTTPS Let's Encrypt)

## Démarrage rapide

Prérequis : Node.js 24.

```sh
npm ci
cp .env.example .env          # puis renseigner les valeurs (voir ci-dessous)
git config core.hooksPath .githooks   # hook pre-commit anti-secrets (une fois)
npm run dev                   # http://localhost:5173
```

### Variables d'environnement

Toutes sont décrites dans [`.env.example`](.env.example). Aucune n'est obligatoire
en local.

| Variable | Rôle |
|---|---|
| `FLAG_SECRET` | Secret HMAC dont sont dérivés les flags. Absent : tiré au hasard à chaque démarrage. |
| `DATABASE_PATH` | Fichier SQLite (défaut : `./breach-academy.db`). |
| `BREACH_VULNERABLE_MODE` | `true` pour rendre les failles jouables. Sinon, seul le mode sécurisé existe. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Notifications push. Absentes : notifications désactivées. |
| `DOMAIN` | Production uniquement : domaine servi par Caddy. |

Aucun secret n'est écrit dans le code ni dans Git : les flags sont dérivés à
l'exécution, et les seuls « secrets » présents dans le dépôt sont les faux secrets
du niveau 5, clairement factices.

## Commandes

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production (client + serveur Nitro) |
| `npm run preview` | Lance le build (`node dist/analog/server/index.mjs`) |
| `npm test` | Tests Vitest, une fois |
| `npm run test:watch` | Tests Vitest en continu |
| `npm run test:coverage` | Tests + couverture (échoue sous 40 % de lignes) |
| `npm run lint` | ESLint (TypeScript + templates Angular) |
| `npm run test:e2e` | Build puis tests E2E Playwright (`e2e/`) |
| `npm run lighthouse` | Audit Lighthouse accessibilité / SEO (voir `docs/LIGHTHOUSE.md`) |
| `npm run web-vitals` | Mesure Lighthouse des trois versions du classement |
| `npm run icons` | Génère les icônes PWA |

> En `npm run dev`, seules les routes sous `/api` atteignent Nitro. Pour la démo du
> niveau 4 (CSRF), utiliser `npm run build && npm run preview` et ouvrir le site sur
> `localhost` **et** `127.0.0.1` (deux origines, un seul serveur).

## Architecture

```
src/
├── app/
│   ├── pages/          # routes par fichiers (*.page.ts) + données serveur (*.server.ts)
│   ├── levels/         # composants des niveaux (level-components.ts)
│   └── leaderboard/    # classement + panneau Web Vitals
├── content/fiches/     # fiches de cours en Markdown (= routes /fiches/…)
├── server/
│   ├── levels/         # logique de chaque niveau, catalogue, progression
│   ├── middleware/     # identité joueur (cookie ba_player), CSP
│   └── routes/api/     # API Nitro (un préfixe par niveau, /api/levels/[id] pour les flags)
└── shared/             # types partagés client/serveur (jamais de flag côté client)
```

- Joueur anonyme identifié par le cookie `ba_player` (`HttpOnly`, `SameSite=Lax`).
- CSP statique posée par un middleware Nitro sur la page du niveau 3, sans
  `'unsafe-inline'` pour les scripts (les autres pages n'ont pas encore de CSP :
  voir [Limites connues](#limites-connues)).
- Le classement existe en trois rendus pour comparer les Web Vitals :
  `/classement/csr`, `/classement/ssr`, `/classement/ssg`
  (voir [`docs/WEB-VITALS.md`](docs/WEB-VITALS.md)).

## Tests

| Type | Outil | Ce qui est vérifié | Commande |
|---|---|---|---|
| Unitaires | Vitest + jsdom | logique des niveaux, validateurs Zod, dérivation des flags, composants Angular | `npm test` |
| Intégration | Vitest | routes API Nitro appelées avec de vraies requêtes h3 : mode vulnérable / sécurisé, refus CSRF, en-têtes CSP | `npm test` |
| End-to-end | Playwright (Chromium) sur le serveur buildé | parcours joueur (capturer un flag déverrouille le niveau suivant) ; chaque attaque **réussit** en mode vulnérable et **échoue** en mode sécurisé ; cookie `HttpOnly` | `npm run test:e2e` |
| Accessibilité | axe-core dans Playwright | WCAG 2.0 → 2.2 A/AA, y compris après interaction (niveau réussi, mode sécurisé) | `npm run test:e2e` |
| Couverture | v8 | 81,9 % des lignes ; seuil CI à 40 % (plancher, pas objectif) | `npm run test:coverage` |

Les tests sont écrits en **TDD** (Red → Green → Refactor) selon le skill
[`.claude/skills/tdd/SKILL.md`](.claude/skills/tdd/SKILL.md) : chaque test doit
pouvoir attraper un bug réaliste. Les tests E2E d'attaque ont été validés en coupant
la faille côté serveur : ils échouent alors bien.

## Sécurité et qualité

- **Hook pre-commit** ([gitleaks](https://github.com/gitleaks/gitleaks)) : bloque
  tout secret avant qu'il n'entre dans le dépôt. S'il n'est pas installé, le hook
  ne bloque rien (la CI l'exécute de toute façon).
- **CI GitHub Actions** (`.github/workflows/ci.yml`) : lint, tests + couverture,
  tests E2E, Semgrep (SAST), gitleaks sur tout l'historique, `npm audit`, build de
  l'image Docker + scan Grype. Les actions sont figées par SHA de commit.
- **TDD** : chaque logique est écrite test d'abord (skill
  `.claude/skills/tdd/SKILL.md`). La couverture de 40 % est un plancher, pas un
  objectif.

## Déploiement

Image Docker multi-stage (`node:24-alpine`) : conteneur en utilisateur non root,
système de fichiers en lecture seule, sans capacités Linux, SQLite sur un volume,
healthcheck. En production, le VPS sert déjà d'autres sites avec nginx : nginx
fait le HTTPS (Let's Encrypt) et relaie vers le conteneur, publié uniquement sur
`127.0.0.1` (`docker-compose.nginx.yml`). Mise à jour :

```sh
VPS=debian@<ip-du-vps> scripts/deploy-vps.sh   # build de l'image sur le VPS + redémarrage
```

Le dépôt contient aussi une variante entièrement automatisée (image publiée sur
GHCR par la CI, `docker-compose.yml` + Caddy). Procédure complète et piège
rencontré (build SSR retombant en JIT sur une machine à 1 CPU) :
[`docs/DEPLOIEMENT.md`](docs/DEPLOIEMENT.md).

## Documentation

| Fichier | Contenu |
|---|---|
| [`docs/IDEES.md`](docs/IDEES.md) | Concept, décisions, détail des niveaux |
| [`docs/PLAN.md`](docs/PLAN.md) | Plan de développement par étapes |
| [`docs/DEPLOIEMENT.md`](docs/DEPLOIEMENT.md) | Pipeline CI/CD et mise en production |
| [`docs/WEB-VITALS.md`](docs/WEB-VITALS.md) | Comparaison CSR / SSR / SSG |
| [`docs/LIGHTHOUSE.md`](docs/LIGHTHOUSE.md) | Accessibilité : audits avant/après, corrections |
| [`docs/SOLUTIONS.md`](docs/SOLUTIONS.md) | Solutions des niveaux |
| [`CLAUDE.md`](CLAUDE.md) | Conventions et pièges techniques (pour l'IA et les humains) |

## Limites connues

- **Pas de maquette Figma** préalable (attendu de la phase 2).
- **CSP limitée au niveau 3** : les autres pages n'envoient pas encore de CSP ni
  d'en-têtes de durcissement (HSTS, `X-Content-Type-Options`…) ; prévu à l'étape 10
  de [`docs/PLAN.md`](docs/PLAN.md).
- La page d'accueil `/` est servie comme une coquille statique (rendu côté
  client), pas en SSR.
- **CI rouge** sur deux jobs : Semgrep signale du code volontairement vulnérable
  pas encore annoté, et `npm audit` remonte des failles publiées après coup dans
  des dépendances indirectes (`esbuild`, `picomatch`, `sharp`). Le site en ligne
  est déployé par `scripts/deploy-vps.sh`.
- Tests E2E limités aux niveaux 1 et 2 (les niveaux 3 à 6 sont couverts par les
  tests d'intégration de leurs routes API).

## IA

Seule IA utilisée : **Claude Code**, en développement assisté (une étape du plan =
une session = un commit). Le cadre est posé dans le dépôt :

- [`CLAUDE.md`](CLAUDE.md) : règles impératives (aucun secret, code vulnérable
  isolé et marqué, TDD) et pièges techniques rencontrés, pour que chaque session
  reparte du bon contexte ;
- skill [`.claude/skills/tdd/SKILL.md`](.claude/skills/tdd/SKILL.md) : impose le
  cycle Red → Green → Refactor et des tests pertinents plutôt que du chiffre de
  couverture ;
- regard critique : les propositions de l'IA sont relues et testées ; plusieurs
  pièges documentés dans `CLAUDE.md` viennent d'échecs silencieux (build qui
  réussit mais SSR cassé, service worker jamais généré…) repérés en vérifiant le
  résultat réel plutôt qu'en faisant confiance au build.
