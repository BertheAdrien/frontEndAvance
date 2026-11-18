# Breach Academy

CTF pédagogique (*Capture The Flag*) : chaque niveau est une faille web réelle,
jouable d'abord en **mode vulnérable** (on l'exploite pour récupérer un flag), puis
en **mode sécurisé** (la même attaque échoue, et un test automatisé le prouve).

Projet du TP « Front-end avancé », thème approfondi **Sécurité + Tests** : CSP,
gestion des secrets, XSS, CSRF ; tests unitaires, d'intégration et E2E ; TDD
assisté par IA (Claude Code).

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
- Déploiement : **Docker** multi-stage + Caddy (HTTPS) sur un VPS

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
- CSP statique posée par un middleware Nitro, sans `'unsafe-inline'` pour les
  scripts.
- Le classement existe en trois rendus pour comparer les Web Vitals :
  `/classement/csr`, `/classement/ssr`, `/classement/ssg`
  (voir [`docs/WEB-VITALS.md`](docs/WEB-VITALS.md)).

## Sécurité et qualité

- **Hook pre-commit** ([gitleaks](https://github.com/gitleaks/gitleaks)) : bloque
  tout secret avant qu'il n'entre dans le dépôt. S'il n'est pas installé, le hook
  ne bloque rien (la CI l'exécute de toute façon).
- **CI GitHub Actions** (`.github/workflows/ci.yml`) : lint, tests + couverture,
  Semgrep (SAST), gitleaks sur tout l'historique, `npm audit`, build de l'image
  Docker + scan Grype, puis déploiement sur le VPS depuis `main`.
- **TDD** : chaque logique est écrite test d'abord (skill
  `.claude/skills/tdd/SKILL.md`). La couverture de 40 % est un plancher, pas un
  objectif.

## Déploiement

Image Docker multi-stage publiée sur GHCR, lancée par `docker-compose.yml`
derrière Caddy (certificat Let's Encrypt automatique). Conteneur en lecture seule,
sans capacités, SQLite sur un volume. Procédure complète :
[`docs/DEPLOIEMENT.md`](docs/DEPLOIEMENT.md).

## Documentation

| Fichier | Contenu |
|---|---|
| [`docs/IDEES.md`](docs/IDEES.md) | Concept, décisions, détail des niveaux |
| [`docs/PLAN.md`](docs/PLAN.md) | Plan de développement par étapes |
| [`docs/DEPLOIEMENT.md`](docs/DEPLOIEMENT.md) | Pipeline CI/CD et mise en production |
| [`docs/WEB-VITALS.md`](docs/WEB-VITALS.md) | Comparaison CSR / SSR / SSG |
| [`docs/SOLUTIONS.md`](docs/SOLUTIONS.md) | Solutions des niveaux |
| [`docs/ORAL.md`](docs/ORAL.md) | Préparation de la présentation |
| [`CLAUDE.md`](CLAUDE.md) | Conventions et pièges techniques (pour l'IA et les humains) |

## IA

Seule IA utilisée : **Claude Code**, en développement assisté (une étape du plan =
une session = un commit), en TDD et en revue de sécurité.
