# Plan de développement — Breach Academy

Une étape = une session Claude Code = un commit.
Le contexte (stack, règles, architecture) est dans `CLAUDE.md`, les idées et
décisions dans `docs/IDEES.md`, la maquette sur
https://claude.ai/artifact/768SAJSjvQigDDispSrm34.

## Comment lancer une étape (économie de tokens)

1. `/clear` avant chaque étape : on repart d'un contexte vide, `CLAUDE.md` suffit.
2. Coller le prompt de l'étape, tel quel. Il est court parce que le détail est ici.
3. Modèle conseillé indiqué par étape : **Sonnet** pour le mécanique,
   **Opus** pour la sécurité et la conception.
4. Relire le résumé final, tester dans le navigateur, puis passer à la suite.

Règles communes à toutes les étapes (l'agent les applique sans qu'on les répète) :
- skill `tdd` pour toute logique ; tests limités à ce qui est pertinent ;
- lancer uniquement les tests touchés pendant le travail, la suite complète à la fin ;
- ne pas relire un fichier déjà lu, ne pas afficher de longues sorties ;
- fin d'étape : `npm test` vert, `npm run build` OK, commit
  `Étape N — <titre>`, pas de push, résumé de 5 lignes maximum ;
- ajouter à `CLAUDE.md` uniquement les faits non évidents découverts (piège,
  convention), jamais de journal de bord.

## Décision prise : mode vulnérable sur le VPS

Validé : `BREACH_VULNERABLE_MODE=true` sur le VPS pour que le jeu soit jouable.
Les failles ne touchent que des faux services isolés (fausse banque, faux bot,
chatbot simulé) ; les vraies parties du site (progression, API des flags)
restent toujours sécurisées. Règle reportée dans `CLAUDE.md`.

---

## Étape 1 — Socle des niveaux · Opus
**Objectif :** tout ce que les 6 niveaux partagent.
- Page générique `/niveaux/[levelId]` (en-tête, fil d'Ariane, consigne) qui
  charge le composant propre à chaque niveau ; niveau verrouillé → redirection
  vers l'accueil.
- `POST /api/levels/:id/flag` (s'appuie sur `submitFlag`), validation Zod,
  limitation de débit simple (anti-force brute).
- Composant « Soumettre le flag » + rafraîchissement de la progression.
- Bascule mode vulnérable / sécurisé : visible seulement si
  `BREACH_VULNERABLE_MODE=true`, choix du joueur mémorisé en cookie, lu côté
  serveur par chaque niveau.
- Page 404 qui renvoie un vrai code HTTP 404.

> Prompt : `Réalise l'étape 1 de docs/PLAN.md.`

## Étape 2 — Niveau 1 : XSS réfléchie · Opus
- Moteur de recherche d'une fausse liste d'articles ; le terme cherché est
  réaffiché.
- Vulnérable : `[innerHTML]` + `bypassSecurityTrustHtml` (marqué
  `// VULNERABLE (démo):`). Sécurisé : interpolation `{{ }}`.
- Le flag est révélé quand du JavaScript s'exécute (ex. une fonction globale
  `window.revealFlag()` appelable seulement en mode vulnérable, qui
  récupère le flag par l'API).
- Fiche « Ce qu'il faut retenir » en bas de page.

> Prompt : `Réalise l'étape 2 de docs/PLAN.md.`

## Étape 3 — Niveau 2 : XSS stockée (livre d'or) · Opus
- Livre d'or en SQLite, messages par joueur.
- Faux bot admin **simulé dans le navigateur du joueur** (pas de navigateur
  headless) : une vue « admin » relit les messages avec un faux cookie admin
  non HttpOnly qui contient le flag.
- Collecteur `/api/evil/collect` qui affiche ce que l'attaquant a volé
  (panneau « console du bot » de la maquette).
- Sécurisé : validation Zod côté serveur, rendu texte, cookie HttpOnly.
- Écran conforme à la maquette (bannière d'état, panneau « La preuve par les
  tests »).

> Prompt : `Réalise l'étape 3 de docs/PLAN.md.`

## Étape 4 — Niveau 3 : CSP · Sonnet
- Middleware Nitro posant la CSP statique de `docs/IDEES.md` sur les pages du
  livre d'or, selon le choix du joueur : aucune / report-only / bloquante.
- Endpoint `report-uri` qui journalise les violations et les affiche dans la
  console du niveau.
- Flag du niveau 3 : obtenu en constatant le blocage (ex. la première violation
  reçue par le serveur le débloque).

> Prompt : `Réalise l'étape 4 de docs/PLAN.md.`

## Étape 5 — Niveau 4 : CSRF · Opus
- Fausse banque (solde, virement, historique) avec sa propre session.
- Page piège servie sur une **autre origine** : `http://127.0.0.1:<port>/piege`
  quand la banque est sur `http://localhost:<port>` (sites différents pour le
  navigateur, un seul serveur).
- Vulnérable : cookie seul. Sécurisé : `SameSite=Strict` + jeton double submit
  (`withXsrfConfiguration` d'Angular + middleware Nitro) + contrôle d'`Origin`.
- Le reçu du virement frauduleux contient le flag.

> Prompt : `Réalise l'étape 5 de docs/PLAN.md.`

## Étape 6 — Niveau 5 : secrets · Sonnet
- Fuite dans le bundle : une fausse clé dans un fichier front, à retrouver
  dans les DevTools (le flag est la clé).
- Fuite dans l'historique Git : un dépôt d'exemple généré à la volée
  (fichier `.git` téléchargeable ou historique affiché), à fouiller avec
  `git log -p` ; présentation de gitleaks.
- Sécurisé : secrets lus côté serveur depuis l'environnement, explication de
  Conjur (implémentation réelle en bonus, étape 15).
- Ajouter gitleaks en hook pre-commit au projet lui-même.

> Prompt : `Réalise l'étape 6 de docs/PLAN.md.`

## Étape 7 — Niveau 6 : chatbot simulé · Sonnet
- Moteur de règles côté serveur (aucun LLM) qui cède aux injections classiques
  en mode vulnérable (ignorer les instructions, répéter le prompt, jeu de rôle,
  injection indirecte via le livre d'or).
- Sécurisé : séparation instructions/données, aucun secret dans le prompt,
  filtrage de la sortie.
- Écran conforme à la maquette.

> Prompt : `Réalise l'étape 7 de docs/PLAN.md.`

## Étape 8 — Classement CSR / SSR / SSG + Web Vitals · Sonnet
- Trois routes rendant le même classement : `/classement/csr`,
  `/classement/ssr`, `/classement/ssg` (pré-rendu activé pour celle-ci seulement).
- Mesure dans le navigateur avec la bibliothèque `web-vitals` (LCP, FCP, TTFB,
  CLS) affichée sur la page.
- Script ou doc pour comparer les trois avec Lighthouse ; résultats dans
  `docs/WEB-VITALS.md`.
- Pseudonyme du joueur (formulaire simple, validé) pour apparaître au classement.

> Prompt : `Réalise l'étape 8 de docs/PLAN.md.`

## Étape 9 — PWA : hors ligne et notifications · Sonnet
- Manifest, icônes, service worker (`vite-plugin-pwa`).
- Fiches de cours (une par faille, en Markdown via `@analogjs/content`)
  disponibles hors ligne.
- Notification push « nouveau niveau débloqué » (clés VAPID en variables
  d'environnement, ajoutées à `.env.example`).

> Prompt : `Réalise l'étape 9 de docs/PLAN.md.`

## Étape 10 — Durcissement transverse · Opus
- En-têtes de sécurité sur tout le site (CSP du site hors niveaux, HSTS,
  `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`).
- Protection CSRF des vraies API (flags, pseudonyme).
- Règle ESLint interdisant `bypassSecurityTrust*` hors code marqué
  `VULNERABLE (démo)`.
- `npm audit` : traiter ce qui est traitable, documenter le reste.

> Prompt : `Réalise l'étape 10 de docs/PLAN.md.`

## Étape 11 — Tests E2E Playwright · Sonnet
- Installation de Playwright, configuration sur le serveur de build.
- Suite « attaques » : chaque niveau attaqué en mode vulnérable (le flag tombe)
  et en mode sécurisé (l'attaque échoue).
- Parcours joueur : capturer un flag → niveau suivant déverrouillé.
- Script `npm run test:e2e`.

> Prompt : `Réalise l'étape 11 de docs/PLAN.md.`

## Étape 12 — CI GitHub Actions + revue IA · Sonnet
- Workflow : lint → tests + couverture (seuil 40 %) → E2E → gitleaks →
  `npm audit` → build de l'image Docker.
- Revue de code par Claude sur chaque PR (action officielle), avec un skill
  `security-review` maison basé sur les niveaux.
- La clé d'API de l'action va dans les secrets GitHub, jamais dans le dépôt.

> Prompt : `Réalise l'étape 12 de docs/PLAN.md.`

## Étape 13 — Docker et mise en production · Sonnet
- Dockerfile multi-stage (Node 24, utilisateur non root, volume pour SQLite).
- `docker-compose.yml` pour le VPS, secrets par variables d'environnement.
- `docs/DEPLOIEMENT.md` : commandes à lancer sur le VPS.

> Prompt : `Réalise l'étape 13 de docs/PLAN.md.`

## Étape 14 — Accessibilité, Lighthouse et SEO · Sonnet
- Audit Lighthouse de chaque page, corrections WCAG 2.2 AA.
- Balises meta, titres uniques, `robots.txt`.
- Scores avant/après dans `docs/LIGHTHOUSE.md`.

> Prompt : `Réalise l'étape 14 de docs/PLAN.md.`

## Étape 15 — Bonus (selon le temps) · Opus
- **15a — Conjur en local** : `docker-compose` (Postgres + Conjur), script
  d'initialisation, `SecretProvider` côté Nitro (Conjur, sinon variables
  d'environnement).
- **15b — Escape room** : remplir les champs `story`, ajouter un minuteur et un
  écran de fin.

> Prompt : `Réalise l'étape 15a de docs/PLAN.md.` (ou 15b)

## Étape 16 — Préparation de l'oral · Opus
- Support de présentation : démo des niveaux, stratégie de tests, skill TDD
  (texte commenté), pipeline, posture critique face à l'IA (exemples réels
  tirés de l'historique Git du projet).

> Prompt : `Prépare le support de l'oral (étape 16 de docs/PLAN.md).`

---

## Ordre conseillé sur 2 jours

| Jour | Étapes | Si le temps manque |
|---|---|---|
| 1 | 1, 2, 3, 4, 5 | 4 peut fusionner avec 3 |
| 2 | 6, 7, 8, 9, 11, 12, 13 | 9 : hors ligne seulement ; 12 : sans revue IA |
| Reste | 10, 14, 15, 16 | 15 est facultative |
