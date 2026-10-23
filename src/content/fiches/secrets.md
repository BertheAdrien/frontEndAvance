---
title: Gestion des secrets
order: 5
level: coffre-qui-fuit
summary: Un secret dans le bundle ou dans l'historique Git est public, même « supprimé ».
---

## Deux fuites classiques

**Dans le bundle front.** Tout ce qui est envoyé au navigateur est lisible :
une clé d'API dans un fichier de configuration Angular se retrouve dans le
JavaScript, à quelques secondes de recherche dans les DevTools.

**Dans l'historique Git.** Un secret commité puis retiré au commit suivant reste
dans l'historique : `git log -p` le montre à quiconque clone le dépôt.
`git rm` ne suffit pas : il faut **révoquer la clé**, puis réécrire l'historique
(`git filter-repo`, BFG).

## Détecter

- **gitleaks** en hook *pre-commit* : le secret n'entre jamais dans le dépôt.
- **gitleaks** en CI et le *secret scanning* de GitHub : le filet si le hook est
  contourné.

## Bien faire

- Les secrets sont lus **à l'exécution, côté serveur**, depuis l'environnement
  (`process.env`) ou un coffre-fort.
- Seul un `.env.example` **sans valeurs** est commité.
- Un coffre comme **Conjur** (CyberArk) centralise les secrets, les fait
  tourner et trace chaque accès.
- Côté navigateur, uniquement des valeurs **publiques par nature** (ex. la clé
  publique VAPID des notifications push).

## À retenir

> Un secret qui a fuité est compromis : on le révoque d'abord, on nettoie
> ensuite.
