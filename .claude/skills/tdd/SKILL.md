---
name: tdd
description: Développement piloté par les tests (Red → Green → Refactor) avec des tests pertinents plutôt que du chiffre de couverture. À utiliser dès qu'on ajoute ou modifie de la logique (composant, service, route API Nitro, middleware, validateur) ou qu'on écrit, complète ou corrige des tests unitaires, d'intégration ou E2E.
---

# TDD — des tests utiles, pas du chiffre

## Pourquoi ce skill existe
Un agent à qui l'on donne un objectif de couverture a tendance à l'atteindre
par le chemin le plus court : tester des getters, mocker tout le monde,
asserter que « ça ne plante pas ». La couverture monte, la confiance non.
Ce skill t'impose l'inverse : **chaque test doit pouvoir attraper un vrai bug**.
Le chiffre de couverture n'est qu'un indicateur de contrôle.

## Le cycle, sans exception
1. **Red** — Écris UN test qui décrit le comportement attendu. Lance-le.
   Il doit échouer, **pour la bonne raison** (assertion fausse, pas une erreur
   d'import ou de syntaxe). Montre la sortie de l'échec.
2. **Green** — Écris le code minimal qui fait passer ce test. Relance-le.
3. **Refactor** — Nettoie le code et le test, relance toute la suite concernée.
   Elle doit rester verte.
4. Recommence pour le comportement suivant.

Ne saute jamais l'étape Red : un test qui n'a jamais échoué n'a rien prouvé.
Si le code existe déjà (test a posteriori), casse temporairement le code
testé pour vérifier que le test échoue, puis restaure-le.

## Ce qu'est un test pertinent
Avant d'écrire un test, réponds à : **« Quel bug réaliste ce test attraperait-il ? »**
Si tu n'as pas de réponse précise, n'écris pas le test.

Un test pertinent :
- vérifie un **comportement observable** (sortie, rendu, réponse HTTP, effet de
  bord), pas un détail d'implémentation ;
- couvre une **règle métier**, un **cas limite** (vide, nul, très long,
  caractères spéciaux) ou un **chemin d'erreur** ;
- dans ce projet, verrouille une **protection de sécurité** : payload XSS non
  exécuté, requête sans jeton CSRF rejetée, en-tête CSP présent, secret absent
  de la réponse. Ces tests sont prioritaires ;
- reste vrai si on réécrit l'implémentation sans changer le comportement ;
- a un nom qui se lit comme une spécification :
  `rejette un commentaire contenant une balise script`.

Un test **non pertinent** (à ne pas écrire) :
- teste un getter/setter trivial, une constante, un modèle sans logique ;
- teste Angular, Vitest, Nitro ou une bibliothèque plutôt que notre code ;
- mocke tellement qu'il ne vérifie plus que ses propres mocks ;
- se contente de `expect(component).toBeTruthy()` ou d'un snapshot géant ;
- duplique un test existant avec une donnée sans nouvel intérêt ;
- n'existe que pour exécuter des lignes (aucune assertion significative).

## Choisir le bon niveau
| Niveau | Outil | Pour quoi |
|---|---|---|
| Unitaire | Vitest | Logique pure : validateurs, services, fonctions utilitaires |
| Intégration | Vitest + routes Nitro | Contrat d'API, middlewares (CSRF, CSP, sessions), accès aux données |
| E2E | Playwright | Parcours utilisateur et preuves de sécurité dans un vrai navigateur |

Préfère le niveau le plus bas capable d'attraper le bug. Ne monte en E2E que
si le comportement n'existe vraiment que dans le navigateur.

## La couverture : un indicateur, pas une cible
- Objectif du projet : **40 %** (voir `CLAUDE.md`).
- Ne lis la couverture qu'**après** avoir écrit les tests pertinents, pour
  repérer du code important oublié, jamais pour choisir quoi tester ensuite
  « parce que c'est rouge ».
- N'écris **jamais** un test dans le seul but de faire monter le pourcentage.

## Condition d'arrêt : rends la main au lieu de forcer
Arrête-toi et fais un rapport dans le chat dès que **l'une** de ces situations
se présente :
- tu as écrit les tests pertinents et la couverture est **sous 40 %** ;
- les seuls tests qui restent possibles sont dans la liste « non pertinent » ;
- atteindre un chemin de code demanderait des mocks si lourds que le test ne
  prouverait plus rien.

Dans ce cas, **n'écris aucun test supplémentaire** et réponds avec ce format :

```
## Bilan des tests
- Couverture actuelle : XX % (lignes) — objectif 40 %
- Tests ajoutés : N (liste courte : fichier → comportement vérifié)
- Code non couvert restant :
  - `chemin/fichier.ts` — pourquoi le tester serait peu utile
- Tests encore possibles et leur valeur estimée :
  - <test> — valeur faible / moyenne, raison

Je m'arrête ici : les tests restants seraient peu pertinents.
Dois-je continuer pour atteindre 40 % avec ces tests moins pertinents ? (oui / non)
```

Attends la réponse explicite avant de continuer. Si la réponse est « oui »,
écris en priorité les tests de valeur « moyenne », et marque chacun d'un
commentaire `// couverture : test à faible valeur ajouté à la demande`
pour qu'ils restent identifiables en revue.

## Avant de déclarer la tâche terminée
- Tous les tests passent (sortie de la commande montrée, pas résumée).
- Chaque nouveau test a été vu en échec au moins une fois.
- Aucun test désactivé (`skip`, `only`, `todo`) laissé dans le code.
- La couverture est indiquée, qu'elle soit au-dessus ou en dessous de 40 %.
