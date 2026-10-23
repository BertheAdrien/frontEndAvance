# frontEndAvance

Projet de TP Front-end avancé — application Angular avec [AnalogJS](https://analogjs.org).

## Hook pre-commit (secrets)

Un hook bloque tout secret avant qu'il n'entre dans le dépôt (voir niveau 5 du
CTF). À activer une fois après le clone :

```sh
git config core.hooksPath .githooks
```

Il s'appuie sur [gitleaks](https://github.com/gitleaks/gitleaks). S'il n'est pas
installé, le hook ne bloque rien (la CI exécute gitleaks de toute façon).
