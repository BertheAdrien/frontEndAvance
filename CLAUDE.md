# CLAUDE.md

Strictly follow the rules in @AGENTS.md (conventions AnalogJS : routing par
fichiers, routes API, data fetching, Angular moderne).

## Contexte
TP d'école « Front-end avancé » (35 h, **2 jours de dev**). Application
front-end moderne, testée, sécurisée et déployée via Docker. Thème approfondi :
**Sécurité + Tests** (CSP, gestion des secrets, XSS, CSRF ; tests unitaires,
d'intégration, E2E ; TDD assisté par IA). Présentation orale finale, avec une
place importante pour l'IA (seule IA utilisée : **Claude Code**).

Projet : **Breach Academy**, un CTF pédagogique où chaque niveau est une faille
web jouable en mode vulnérable puis sécurisé. Détails, niveaux et planning :
`docs/IDEES.md`.

## Stack
- Méta-framework : **AnalogJS 2.9** (Angular 22 + Vite 8), TypeScript strict,
  Tailwind CSS 4
- Backend : routes API **Nitro/h3** intégrées à Analog
  (`src/server/routes/api/`), aucun backend séparé
- Persistance : **SQLite** (fichier, ignoré par Git)
- Interpréteur : **Node.js 24 LTS**
- Tests : Vitest (unitaires + intégration), Playwright (E2E)
- PWA : service worker, mode hors ligne, Web Push
- CSP : politique statique posée par un middleware Nitro (pas de nonce)
- Secrets : variables d'environnement ; Conjur OSS en local pour la démo
- Déploiement : Docker (build multi-stage) sur un VPS

## Commandes
- `npm run dev` — serveur de développement
- `npm run build` — build de production (client + serveur Nitro)
- `npm run preview` — lance le build (`node dist/analog/server/index.mjs`)
- `npm test` — tests Vitest une fois ; `npm run test:watch` en continu
- `npm run test:coverage` — tests + couverture (échoue sous le seuil)

## Architecture
- `src/app/pages/` : routes (fichiers `*.page.ts`), données serveur via un
  `*.server.ts` voisin (`load` + `injectLoad`)
- `src/server/` : logique serveur (SQLite, niveaux, joueur) et routes Nitro
- `src/shared/` : types partagés client/serveur (jamais de flag côté client)
- Joueur anonyme identifié par le cookie `ba_player` (HttpOnly, SameSite=Lax)
- Flags dérivés de `FLAG_SECRET` (HMAC), jamais écrits dans le dépôt
- Variables d'environnement : voir `.env.example`
- SSR : `forwardCookieInterceptor` doit rester **avant**
  `requestContextInterceptor` dans `app.config.ts`, sinon les `load` ne
  reçoivent pas le cookie du joueur
- Pré-rendu (SSG) désactivé par défaut dans `vite.config.ts`, à activer route
  par route
- Un `Set-Cookie` posé dans un `load` n'atteint jamais le navigateur (appel
  interne pendant le SSR) : l'identité joueur est créée par
  `src/server/middleware/player.ts`
- Code HTTP d'une page (404, redirection 302) : `injectHttpStatus()`
  (`src/app/http-status.ts`), pas le `load`
- h3 retire les caractères non ASCII de `statusMessage` : mettre les textes
  d'erreur en français dans `message`
- Nouveau niveau : déclarer son composant dans
  `src/app/levels/level-components.ts` (entrées `level`, `mode`) ; côté
  serveur, le mode se lit avec `getLevelMode(event)` (`src/server/mode.ts`)
- Pas de `declare global` dans un fichier de composant : le build Analog
  retombe alors en JIT pour toute l'app (SSR en erreur « JIT compiler
  unavailable », sans erreur au build ni en test). Typer par un cast local.
- Routes API d'un niveau : préfixe dédié (`/api/<levelId>/…`), pas sous
  `/api/levels/[id]/` qui porte l'API des flags.

## Règles impératives
- **Aucun secret dans le code ni dans Git** (clés API, mots de passe, tokens,
  clés VAPID…). Les secrets sont lus à l'exécution (variables d'environnement /
  Conjur). Seul un `.env.example` sans valeurs réelles peut être commité.
  Exception pédagogique : les faux secrets du niveau 5, clairement factices.
- **Lecture seule sur le connecteur Phrase** : aucune opération d'écriture.
- **TDD** : pour toute nouvelle logique, écrire d'abord le test qui échoue,
  le lancer, puis implémenter. Suivre le skill `.claude/skills/tdd/SKILL.md`
  dès qu'on écrit ou modifie de la logique ou des tests.
- **Couverture** : objectif **40 %** de lignes (Vitest, `coverage.thresholds`
  dans `vite.config.ts`, appliqué en CI). C'est un plancher indicatif, **pas
  un objectif à atteindre à tout prix** : la pertinence des tests prime.
- Code volontairement vulnérable (démo pédagogique) : uniquement derrière le flag
  `BREACH_VULNERABLE_MODE` (désactivé par défaut, activé sur le VPS pour que le
  jeu soit jouable), et marqué par un commentaire `// VULNERABLE (démo):`
  expliquant la faille. Les failles ne touchent **que des faux services isolés**
  (fausse banque, faux bot, chatbot simulé) ; les vraies parties du site
  (progression, API des flags, sessions) restent toujours sécurisées.
- Hors code vulnérable assumé : ne jamais utiliser `bypassSecurityTrust*`,
  `innerHTML` non nettoyé, ni `'unsafe-inline'` / `'unsafe-eval'` pour les
  scripts dans la CSP.
- Le chatbot du niveau 6 est **simulé** (aucun appel à une API de LLM).

## Déroulé des étapes
Le développement suit `docs/PLAN.md` (une étape = une session = un commit).
Appliquer les « Règles communes » de ce fichier à chaque étape.

## Conventions
- Documentation et messages de commit en français.
- Accessibilité visée : WCAG 2.2 AA (vérifiée avec Lighthouse).
- Données des niveaux pensées pour une évolution « escape room » (ordre,
  déverrouillage, texte narratif) sans refonte.
