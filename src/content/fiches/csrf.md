---
title: CSRF
order: 4
level: virement-fantome
summary: Une page piège fait exécuter une action à la victime, avec ses propres cookies.
---

## Le principe

Le **Cross-Site Request Forgery** exploite le fait que le navigateur joint
automatiquement les cookies d'un site aux requêtes vers ce site, **même
déclenchées depuis une autre origine**. Une page piège peut donc faire signer à
la victime une action qu'elle n'a pas voulue : virement, changement d'e-mail…

```html
<!-- Sur le site de l'attaquant -->
<a href="https://banque.example/virement?vers=attaquant&montant=1000">Gagnez un iPhone</a>
```

## Les défenses

1. **Jamais de changement d'état sur un `GET`** : un `GET` doit être sans effet.
2. **Cookie `SameSite`** :
   - `Lax` (défaut des navigateurs) : le cookie part encore sur une navigation
     de premier plan en `GET` ;
   - `Strict` : le cookie ne part jamais depuis un autre site.
3. **Jeton anti-CSRF** (*double submit*) : le serveur pose un cookie lisible
   `XSRF-TOKEN` ; Angular (`withXsrfConfiguration`) le recopie dans l'en-tête
   `X-XSRF-TOKEN`. Une autre origine ne peut pas lire ce cookie, donc pas forger
   l'en-tête.
4. **Contrôle de l'en-tête `Origin`** côté serveur.

## À retenir

> Le cookie prouve *qui* fait la requête, pas *d'où* elle vient. Le jeton, le
> contrôle d'origine et `SameSite` comblent ce manque.
