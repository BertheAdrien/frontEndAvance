---
title: XSS réfléchie
order: 1
level: recherche-bavarde
summary: Une saisie renvoyée dans la page sans échappement exécute du code chez la victime.
---

## Le principe

Une **XSS réfléchie** (*reflected cross-site scripting*) se produit quand le site
réaffiche une donnée venue de la requête (paramètre d'URL, champ de formulaire)
**sans l'échapper**. Le navigateur interprète alors cette donnée comme du HTML,
et un attribut d'événement suffit à exécuter du JavaScript.

L'attaque tient dans un lien : `https://site.example/recherche?q=<img src=x onerror=…>`.
La victime clique, la page réaffiche le terme, le code s'exécute **dans son
navigateur, avec sa session**.

## Pourquoi c'est grave

- Le script agit au nom de la victime : lecture de la page, requêtes vers l'API,
  vol des données affichées, faux formulaire de connexion.
- Les cookies non `HttpOnly` sont lisibles via `document.cookie`.

## Ce qu'il ne faut pas faire (Angular)

```ts
// Contourne la protection d'Angular : la saisie devient du HTML « de confiance ».
this.html = this.sanitizer.bypassSecurityTrustHtml(`Résultats pour ${terme}`);
```

```html
<p [innerHTML]="html"></p>
```

Une balise `<script>` insérée par `innerHTML` ne s'exécute pas, mais
`<img src=x onerror="…">` ou `<svg onload="…">` si.

## La défense

1. **Interpolation** `{{ terme }}` : Angular échappe tout, par défaut.
2. Si du HTML est vraiment nécessaire, `[innerHTML]` **sans** contournement :
   Angular le nettoie (attributs `on*` retirés).
3. **Aucun `bypassSecurityTrust*`** sur une donnée utilisateur (règle ESLint).
4. Une **CSP** sans `'unsafe-inline'` comme filet de sécurité.

## À retenir

> Une donnée utilisateur ne devient jamais du code. Échapper à la sortie,
> valider à l'entrée, et ne jamais désactiver les protections du framework.
