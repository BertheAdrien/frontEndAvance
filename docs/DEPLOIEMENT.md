# Déploiement — Breach Academy

## Pipeline (`.github/workflows/ci.yml`)

Chaque job est une étape distincte dans l'onglet *Actions* de GitHub.

| Job | Outil | Échoue si… |
|---|---|---|
| Lint | ESLint + angular-eslint | une erreur de lint |
| Tests unitaires + couverture | Vitest + v8 | un test échoue ou lignes < seuil (`vite.config.ts`) |
| Tests E2E | Playwright (Chromium, serveur buildé) | une attaque réussit en mode sécurisé ou échoue en mode vulnérable |
| SAST | Semgrep (règles `p/default`, `p/typescript`, `p/owasp-top-ten`) | une alerte non justifiée par `// nosemgrep` |
| Secrets | gitleaks (tout l'historique Git) | un secret détecté |
| Dépendances | `npm audit --omit=dev` | une faille *high* ou *critical* en production |
| Image Docker | build multi-stage + Grype | une faille *critical* corrigeable dans l'image |
| Déploiement VPS | SSH + `docker compose` | — (uniquement sur `main`) |

Les six premiers jobs tournent en parallèle ; l'image n'est construite que
s'ils passent tous, et poussée sur GHCR (`ghcr.io/bertheadrien/frontendavance`)
seulement sur `main`. Les rapports Semgrep et Grype arrivent dans l'onglet
*Security → Code scanning* (gratuit, dépôt public). La couverture HTML est
téléchargeable en artefact du job de tests.

## Déploiement actuel : VPS avec nginx existant

Le site tourne sur https://breach-academy.bertadrien.fr. Le VPS héberge déjà
d'autres sites derrière nginx (ports 80/443 pris) : pas de Caddy, nginx fait le
HTTPS (certificat Let's Encrypt via `certbot --nginx`) et relaie vers le conteneur.

| Élément | Emplacement sur le VPS |
|---|---|
| Compose (copie de `docker-compose.nginx.yml`) + `.env` (chmod 600) | `~/breach-academy/` |
| Sources envoyées pour le build | `~/breach-academy-src/` |
| Vhost nginx | `/etc/nginx/sites-available/breach-academy.bertadrien.fr.conf` |

Mettre à jour le site depuis le poste (build **sur le VPS** avec le `Dockerfile`
du dépôt, puis redémarrage du conteneur) :

```bash
VPS=debian@<ip-du-vps> scripts/deploy-vps.sh
```

Vhost nginx (avant `certbot --nginx -d <domaine> --redirect`, qui ajoute le TLS) :

```nginx
server {
    listen 80;
    server_name breach-academy.bertadrien.fr;
    location / {
        proxy_pass http://127.0.0.1:3010;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

`FLAG_SECRET` a été généré sur le serveur (`openssl rand -hex 32`) et n'en sort pas.

### Piège : build en JIT sur une machine lente

Analog construit le client et le SSR **en parallèle** avec une seule compilation
Angular ; le `buildEnd` du premier fini la libérait, et les composants que le SSR
traitait ensuite partaient en JIT, sans avertissement (« JIT compiler
unavailable » au rendu). Invisible sur un poste multicœur, systématique sur le
VPS (1 CPU). Corrigé par `build/angular-build-end.ts` (branché dans
`vite.config.ts`, testé). Vérifier une image :

```bash
docker run --rm --entrypoint sh <image> -c 'grep -rl "__decorate(\[" server/chunks | wc -l'   # doit afficher 0
```

## Préparer le VPS (une seule fois) — variante Caddy + CI

Prérequis : Docker + plugin Compose, ports 80 et 443 ouverts, un nom de domaine
(enregistrement A) pointant vers le VPS. HTTPS est obligatoire : les cookies
sont `Secure` en production.

```bash
# Utilisateur dédié au déploiement, autorisé à piloter Docker
sudo adduser --disabled-password deploy
sudo usermod -aG docker deploy

# Dossier de l'application et secrets (jamais dans Git)
sudo -u deploy mkdir -p /home/deploy/breach-academy
sudo -u deploy tee /home/deploy/breach-academy/.env > /dev/null <<EOF
DOMAIN=breach.example.org
FLAG_SECRET=$(openssl rand -hex 32)
BREACH_VULNERABLE_MODE=true
EOF
sudo chmod 600 /home/deploy/breach-academy/.env
```

Notifications push (facultatif) : générer une paire de clés VAPID et l'ajouter au
même `.env`. Sans ces trois variables, le bouton « Activer les notifications »
n'apparaît pas.

```bash
docker run --rm node:24-alpine npx -y web-push generate-vapid-keys --json
# puis, dans .env : VAPID_PUBLIC_KEY=…, VAPID_PRIVATE_KEY=…, VAPID_SUBJECT=mailto:<contact>
```

Clé SSH réservée à la CI (sur votre poste) :

```bash
ssh-keygen -t ed25519 -f ~/.ssh/breach_deploy -N "" -C "github-actions"
ssh-copy-id -i ~/.ssh/breach_deploy.pub deploy@<ip-du-vps>
```

## Configurer GitHub (Settings → Secrets and variables → Actions)

| Type | Nom | Valeur |
|---|---|---|
| Secret | `VPS_HOST` | IP ou nom du VPS |
| Secret | `VPS_USER` | `deploy` |
| Secret | `VPS_SSH_KEY` | contenu de `~/.ssh/breach_deploy` (clé **privée**) |
| Secret | `VPS_PORT` | facultatif, 22 par défaut |
| Variable | `DOMAIN` | domaine public (lien affiché sur le déploiement) |
| Variable | `VPS_APP_DIR` | facultatif, `breach-academy` par défaut (relatif au home) |

Créer aussi l'environnement **production** (Settings → Environments) : on peut y
exiger une validation manuelle avant chaque déploiement.

Le VPS se connecte à GHCR avec le jeton éphémère du job (`GITHUB_TOKEN`), puis
se déconnecte : aucun jeton n'est stocké sur le serveur.

## Opérations manuelles sur le VPS

```bash
cd ~/breach-academy
docker compose ps                         # état (healthcheck de l'app inclus)
docker compose logs -f app                # journaux
IMAGE_TAG=sha-abc1234 docker compose up -d app   # retour à une version précédente
```

La base SQLite vit dans le volume `sqlite-data` (`/data` dans le conteneur) ;
le conteneur tourne en utilisateur `node`, système de fichiers en lecture seule,
sans capacités Linux.

## Tester l'image en local

```bash
docker build -t breach-academy .
docker run --rm -p 3000:3000 -e FLAG_SECRET=dev -e NODE_ENV=development breach-academy
```

`NODE_ENV=development` retire l'attribut `Secure` des cookies pour pouvoir
jouer en HTTP sur `localhost`.
