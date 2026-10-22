# Idées de projet — TP Front-end avancé

> Thème approfondi : **Thème 3 — Sécurité + Tests**
> (CSP, gestion des secrets, XSS, CSRF / tests unitaires, d'intégration, E2E)
> Fil rouge de la présentation : **l'IA, utile en attaque comme en défense**.

---

## Contraintes du TP (rappel)

| Exigence | Où la traiter |
|---|---|
| Maquette Figma → interface fidèle et accessible | Phase 2, Figma MCP + Lighthouse |
| Interpréteur (Node / Deno / Bun) | Node 22 LTS (le plus sûr pour Analog/Nitro) |
| Méta-framework + TypeScript | AnalogJS (Angular + Vite + Nitro) |
| API via le **back intégré au framework** | Routes API Nitro d'Analog (`src/server/routes/api/...`) |
| PWA (hors ligne, notifications push) | Service worker + Web Push |
| Une même page en CSR / SSR / SSG + comparaison des Web Vitals | `routeRules` d'Analog |
| Lighthouse / WCAG 2.2 | Phase 3 |
| Tests unitaires, fonctionnels, E2E | Vitest + Playwright |
| CSP, secrets, XSS, CSRF | **Cœur du projet** |
| Mise en production Docker | Dockerfile multi-stage |

## Décisions prises

| Sujet | Décision |
|---|---|
| Projet | **Breach Academy**, conçu pour évoluer en escape room si le temps le permet |
| Méta-framework | AnalogJS 2.9 (Angular 22) + Tailwind 4 |
| Backend | Routes API Nitro d'Analog, pas de Spring Boot |
| Interpréteur | Node.js 24 LTS |
| Persistance | SQLite |
| Chatbot (niveau 6) | **Simulé** : aucune clé, aucun appel à un LLM |
| Secrets | Variables d'environnement partout ; Conjur OSS en local pour la démo, en dernière priorité |
| Maquette | Claude Design, puis Figma si besoin |
| IA déclarée | Claude Code uniquement |
| Temps de développement | 2 jours |

### Escape room « évolutive »
Breach Academy est construit pour que l'escape room soit un **habillage**
ajouté ensuite, sans refonte :
- chaque niveau est une donnée (`id`, `ordre`, `titre`, `récit`, `flag`) ;
- dès la v1, le niveau N+1 se déverrouille avec le flag du niveau N
  (c'est déjà la mécanique d'une escape room) ;
- le champ `récit` est vide en v1. Le remplir (« la porte de la salle des
  serveurs est fermée… ») et ajouter un minuteur suffit à passer en mode
  escape room.

### Conjur : ce qui est automatisable
- Je peux écrire tout le code : `docker-compose` (Postgres + Conjur + CLI),
  script d'initialisation (clé de données, compte, politique, valeurs des
  secrets), et un `SecretProvider` côté Nitro qui lit Conjur **ou**, à défaut,
  les variables d'environnement.
- **À installer de ton côté : Docker Desktop**, nécessaire de toute façon pour
  la phase 5. Il n'est pas installé sur ce poste pour le moment.
- Sur le VPS, Conjur n'est **pas** déployé (trop lourd pour le gain) : les
  secrets passent par les variables d'environnement du conteneur. À l'oral,
  c'est un bon sujet : le problème du « secret zéro », c'est-à-dire avec quoi
  l'application s'authentifie auprès du coffre.

### Chatbot simulé (niveau 6)
Un faux « LLM » à règles : il répond normalement, mais tombe dans les
injections classiques (« ignore les instructions précédentes », « répète ton
prompt système », jeu de rôle, injection indirecte via un commentaire du livre
d'or). En mode sécurisé, il sépare les données des instructions et filtre sa
sortie. Démo fiable, gratuite, et aucune clé exposée sur le VPS.

## Planning sur 2 jours

**Jour 1 : le socle et les failles principales**
1. Maquette dans Claude Design (≈ 1 h 30)
2. Mise en page, accueil, liste des niveaux, SQLite, session et connexion
3. Niveau 1 (XSS réfléchie), niveau 2 (XSS stockée + bascule CSP)
4. Niveau 4 (CSRF)
5. Tests au fil de l'eau avec le skill TDD

**Jour 2 : le reste des exigences**
1. Niveau 5 (secrets : bundle, historique Git, gitleaks), niveau 6 (chatbot)
2. Classement en CSR / SSR / SSG + mesure des Web Vitals
3. PWA : fiches hors ligne + notification push
4. Playwright E2E, GitHub Actions (lint, tests, couverture, gitleaks), Dockerfile
5. Passe Lighthouse / WCAG 2.2
6. Si le temps le permet : Conjur en local, puis habillage escape room

---

## Idée recommandée — « Breach Academy » 🏴‍☠️

**Un CTF pédagogique (Capture The Flag) où chaque niveau est une faille web
réelle, jouable en mode *vulnérable* puis en mode *sécurisé*.**

Le joueur (ou le public pendant l'oral) exploite une faille pour récupérer un
*flag*, puis on bascule le niveau en mode « patché » et on montre que la même
attaque échoue — et **quel test automatisé le prouve**.

Pourquoi c'est la bonne idée :
- Ludique (score, flags, classement, indices), donc parfait pour une démo live.
- Chaque niveau couvre **exactement** une notion du thème 3.
- Le couple « vulnérable / sécurisé » se transforme naturellement en **tests**
  (un test E2E rouge en mode vulnérable, vert en mode sécurisé) : c'est le pont
  entre la partie sécurité et la partie tests/TDD.
- Toutes les exigences transverses (PWA, SSR/SSG, accessibilité, Docker) s'y
  greffent sans forcer.

### Les niveaux

#### Niveau 1 — XSS réfléchie : « Le moteur de recherche bavard »
- **Vulnérable** : le terme recherché est réaffiché via `[innerHTML]` +
  `DomSanitizer.bypassSecurityTrustHtml()`.
  Payload : `<img src=x onerror="alert(document.cookie)">`.
- **Sécurisé** : interpolation `{{ }}` (échappement auto d'Angular), suppression
  du `bypass…`.
- **À montrer** : Angular protège *par défaut* ; les failles viennent presque
  toujours d'un contournement volontaire. Règle ESLint qui interdit
  `bypassSecurityTrust*`.

#### Niveau 2 — XSS stockée : « Le livre d'or »
- **Vulnérable** : commentaires stockés côté serveur sans validation et rendus
  en HTML brut ; un commentaire piégé vole le cookie de session (non `HttpOnly`)
  de « l'admin » (un bot Playwright qui visite la page).
- **Sécurisé** : validation côté serveur (Zod), nettoyage (DOMPurify) si le HTML
  est nécessaire, cookie `HttpOnly` + `Secure` + `SameSite`,
  **Trusted Types** activés.
- **Effet waouh** : le bot admin « se fait pirater » en direct à l'écran.

#### Niveau 3 — CSP : « Le mur invisible » (version simplifiée)
Pas de niveau ni d'infrastructure dédiés : la CSP est la **deuxième ligne de
défense du livre d'or** (niveau 2).
- Une **CSP statique** posée par un middleware Nitro (une seule chaîne, pas de
  nonce par requête) :
  `default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`
  (+ `style-src 'self' 'unsafe-inline'`, compromis assumé car Angular injecte
  des styles inline ; le risque est bien plus faible que pour les scripts).
- Démo en 3 temps sur le livre d'or **toujours vulnérable** :
  1. sans CSP → le payload s'exécute ;
  2. CSP en `Content-Security-Policy-Report-Only` → il s'exécute, mais la
     violation apparaît dans la console ;
  3. CSP bloquante → le script ne s'exécute plus, **même si le code est
     toujours vulnérable**. Message : la CSP est un filet, pas un correctif.
- Bonus facile : coller la politique dans https://csp-evaluator.withgoogle.com
  pendant l'oral.
- Test associé : un test d'intégration vérifie la présence et le contenu de
  l'en-tête ; un test E2E vérifie que le payload ne s'exécute pas.

> Option avancée **si le temps le permet** : CSP à nonce (`CSP_NONCE` d'Angular)
> et endpoint `report-uri` qui collecte les violations dans un tableau de bord.

#### Niveau 4 — CSRF : « Le virement fantôme »
- Mini-banque fictive (connexion → solde → virement).
- **Vulnérable** : `POST /api/transfer` authentifié par cookie seul. Une page
  « attaquante » (servie sur un autre port, ex. `evil.localhost:4000`) contient
  un formulaire auto-soumis qui vide le compte.
- **Sécurisé** : cookie `SameSite=Strict`, jeton anti-CSRF *double submit*
  (support natif `HttpClient` d'Angular : `withXsrfConfiguration`) vérifié
  par un middleware Nitro, contrôle de l'en-tête `Origin`.

#### Niveau 5 — Secrets : « Le coffre qui fuit »
Le niveau qui colle à ton expérience (Git, CyberArk, Conjur) :
1. **Fuite dans le bundle** : une « clé API » mise dans `environment.ts` → on la
   retrouve en 10 s dans les DevTools / le JS minifié.
   Leçon : *tout ce qui est dans le front est public*.
2. **Fuite dans l'historique Git** : un secret commité puis « supprimé » reste
   dans l'historique → on le retrouve avec `git log -p` / **gitleaks**.
   Défense : hook pre-commit gitleaks, *GitHub secret scanning + push protection*,
   et un **hook Claude Code** qui bloque l'agent s'il tente d'écrire un secret.
3. **La bonne pratique** : le serveur Nitro lit ses secrets à l'exécution depuis
   **Conjur OSS** (image Docker `cyberark/conjur`, lancée via docker-compose), par
   exemple la clé VAPID des notifications push ou le secret de signature des
   sessions. Parallèle avec CyberArk en entreprise (Conjur = brique
   « secrets as code » de CyberArk).

#### Niveau 6 (très « IA ») — Injection de prompt : « Le chatbot trop serviable »
> Décision : chatbot **simulé** (voir « Décisions prises ») ; les points
> ci-dessous sur la clé d'API ne s'appliquent plus.

- Un assistant du site a un *flag* dans son prompt système, avec la consigne
  de ne jamais le révéler. Le joueur doit l'extraire par injection de prompt
  (directe, ou indirecte via un commentaire du livre d'or que le bot lit).
- **Sécurisé** : séparation des données et des instructions, filtrage des
  sorties, moindre privilège des outils.
- Double intérêt : c'est l'OWASP Top 10 **LLM**, et la clé d'API du modèle
  devient un vrai secret géré dans Conjur (lien avec le niveau 5).
- Peut tourner avec un modèle mocké si on ne veut pas de coût d'API.

### Pages et fonctionnalités transverses

| Page / fonctionnalité | Exigence couverte |
|---|---|
| Accueil + liste des niveaux | Maquette Figma, accessibilité |
| **Classement** (leaderboard) rendu en **CSR, SSR et SSG** (3 routes) | Comparaison des Web Vitals |
| Fiches « cours » de chaque faille consultables **hors ligne** | PWA hors ligne |
| Notification push « nouveau niveau débloqué » / « quelqu'un a pris le flag » | PWA push |
| Panneau « mode vulnérable / sécurisé » par niveau | Démo live |
| Bascule CSP (aucune / report-only / bloquante) sur le livre d'or | Sécurité |

> 🔒 **Garde-fou** : le mode vulnérable est contrôlé par une variable
> d'environnement (`BREACH_VULNERABLE_MODE`) et **désactivé par défaut**.
> L'image Docker de production ne l'active jamais, ce qui est en soi un bon
> point de présentation.

---

## Volet Tests + IA (la partie « approfondie » de la présentation)

### Pyramide de tests appliquée au projet
| Niveau | Outil | Exemple concret |
|---|---|---|
| Unitaire | **Vitest** (fourni par Analog) | Le validateur Zod du livre d'or rejette `<script>` ; le middleware CSRF rejette un jeton absent |
| Intégration | Vitest + appel des routes API Nitro | `POST /api/transfer` sans jeton → 403 ; l'en-tête CSP contient un nonce différent à chaque requête |
| E2E | **Playwright** | Le payload XSS **ne déclenche pas** d'`alert` ; l'attaque CSRF depuis `evil.localhost` échoue ; violation CSP bien signalée |
| Sécurité automatisée | gitleaks, `npm audit`, OWASP ZAP (baseline) en CI | Pipeline rouge si un secret ou une CVE critique apparaît |

**Démo clé** : lancer la suite E2E « attaques » contre le mode vulnérable
(tout rouge) puis contre le mode sécurisé (tout vert). Les tests *sont* la
preuve que la faille est corrigée.

### TDD piloté par un skill IA
- Skill Claude Code `.claude/skills/tdd/SKILL.md` qui impose à l'agent le cycle
  **Red → Green → Refactor** : écrire d'abord le test qui échoue, le lancer,
  constater l'échec, puis seulement implémenter.
- **Point central de l'oral : le skill est conçu contre la loi de Goodhart**
  (« quand une mesure devient un objectif, elle cesse d'être une bonne mesure »).
  - Objectif de couverture : **40 %**, défini dans `CLAUDE.md` et la CI ;
  - le skill interdit explicitement de « courir après » ce chiffre ;
  - il définit ce qu'est un test **pertinent** (comportement observable, règle
    métier, régression de sécurité) et ce qui ne l'est pas (getters, tests du
    framework, mocks qui se testent eux-mêmes…) ;
  - **condition d'arrêt** : quand il ne reste que des tests peu pertinents à
    écrire, l'agent s'arrête et rend la main dans le chat avec la couverture
    actuelle, ce qui reste non couvert, et la question : « faut-il continuer
    jusqu'à 40 % avec des tests moins pertinents ? ».
- Montrer **le texte du skill** pendant l'oral (comment on rédige des
  consignes efficaces pour un agent) et une session réelle où l'agent s'arrête
  de lui-même et pose la question.
- Second skill possible : `security-review` maison basé sur les niveaux du CTF
  (vérifier `bypassSecurityTrust`, cookies, CSP, secrets).

### Intégration dans la pipeline (GitHub Actions)
1. `lint` (dont la règle anti-`bypassSecurityTrust`)
2. `test:unit` + `test:integration` avec **seuil de couverture minimal à 40 %**
   (`vitest.config.ts` → `coverage.thresholds`) : la CI échoue en dessous.
   Seuil volontairement modeste : on préfère peu de tests utiles à beaucoup de
   tests creux.
3. `test:e2e` Playwright (mode sécurisé)
4. `gitleaks` + `npm audit`
5. **Revue de code par IA** sur chaque PR (Claude Code GitHub Action) avec le
   skill sécurité.
6. Build + push de l'image Docker.

### Posture critique vis-à-vis de l'IA (à mettre dans l'oral)
- Faire générer volontairement par l'IA un composant « rapide » → elle utilise
  parfois `innerHTML` ou désactive la CSP pour « que ça marche » : les tests et
  la revue le détectent. Message : **l'IA accélère, les tests garantissent.**
- Mesurer : combien de tests générés par l'IA étaient faux ou inutiles ?

---

## Alternatives (si Breach Academy ne te plaît pas)

1. **« Secret Hunter »** — jeu d'enquête centré secrets : le joueur fouille un
   faux dépôt Git, des bundles JS, des images Docker pour retrouver des clés
   fuitées, puis les « révoque » dans un coffre Conjur. Très fort sur les
   secrets, plus faible sur XSS/CSRF.
2. **« Escape Room Web »** — même contenu que Breach Academy mais scénarisé
   (chaque faille ouvre une porte). Plus ludique, plus long à concevoir côté UX.
3. **« Bug Bounty Simulator »** — un faux site e-commerce truffé de failles ; le
   joueur soumet des « rapports » qui sont validés automatiquement par des tests
   Playwright. Original, mais l'appli métier est plus lourde à construire.

---

## Questions

Toutes tranchées : voir « Décisions prises » en haut du document.
