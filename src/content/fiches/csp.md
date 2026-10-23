---
title: Content Security Policy
order: 3
level: mur-invisible
summary: La CSP dit au navigateur quels scripts exécuter ; elle bloque l'injection même si le code reste vulnérable.
---

## Le principe

La **Content Security Policy** est un en-tête HTTP qui liste les sources
autorisées pour chaque type de ressource. Exemple :

```
Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none';
  base-uri 'self'; frame-ancestors 'none'; report-uri /api/csp-report
```

Avec `script-src 'self'` et **sans `'unsafe-inline'`**, le navigateur refuse les
scripts inline et les attributs `onerror`, `onclick`… : le payload XSS est
bloqué.

## Les deux modes

- `Content-Security-Policy-Report-Only` : rien n'est bloqué, mais chaque
  violation est **signalée** (console, `report-uri`). Idéal pour tester une
  politique en production sans rien casser.
- `Content-Security-Policy` : la politique est **appliquée**.

Démarche classique : déployer en *report-only*, corriger les violations
légitimes, puis passer en mode bloquant.

## Les limites

- La CSP est un **filet**, pas un correctif : la faille XSS existe toujours.
- Elle vient de l'en-tête du **document** : une navigation interne d'une SPA ne
  la change pas.
- Le site lui-même ne doit contenir **aucun script inline** (sinon il faudrait
  `'unsafe-inline'`, ou des nonces / empreintes).
- Un rapport de violation peut être forgé : le serveur le valide et en borne la
  taille.

## À retenir

> Corriger la faille d'abord, poser la CSP ensuite : c'est elle qui protège
> le jour où une nouvelle faille passe la revue de code.
