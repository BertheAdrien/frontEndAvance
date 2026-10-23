---
title: XSS stockée
order: 2
level: livre-d-or
summary: Un contenu piégé enregistré par le serveur s'exécute chez chaque personne qui le relit.
---

## Le principe

Dans une **XSS stockée**, le payload est **enregistré** (commentaire, profil,
message) puis affiché à d'autres utilisateurs. L'attaquant n'a plus besoin de
faire cliquer un lien : chaque visiteur de la page devient victime, y compris un
administrateur qui modère les messages.

## Le scénario du livre d'or

1. L'attaquant poste un message contenant `<img src=x onerror="…">`.
2. Le bot administrateur relit les messages ; le livre d'or les rend en HTML.
3. Le script lit `document.cookie` (la session admin n'est **pas `HttpOnly`**)
   et l'envoie au collecteur de l'attaquant.
4. Avec ce cookie, l'attaquant se fait passer pour l'administrateur.

## La défense, en profondeur

| Couche | Mesure |
|---|---|
| Entrée | Validation serveur (Zod) : longueur, refus du HTML |
| Sortie | Rendu **texte** côté client (`{{ }}`), jamais `bypassSecurityTrust*` |
| Session | Cookies `HttpOnly` (illisibles en JavaScript), `Secure`, `SameSite` |
| Navigateur | CSP sans `'unsafe-inline'` |

Chaque couche couvre l'oubli d'une autre : la validation seule ne suffit pas
(un autre client peut écrire en base), l'échappement seul non plus (un
développeur peut le contourner).

## À retenir

> La donnée stockée est aussi peu fiable que la donnée reçue. On échappe au
> moment de l'affichage, et on rend les cookies de session inaccessibles au
> JavaScript.
