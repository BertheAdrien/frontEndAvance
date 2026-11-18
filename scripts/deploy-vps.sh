#!/usr/bin/env bash
# Déploiement manuel sur le VPS : envoie les fichiers suivis par Git (+ nouveaux fichiers
# non ignorés), construit l'image avec le Dockerfile du dépôt SUR le VPS, puis relance
# le conteneur. Aucun secret ici : FLAG_SECRET & co vivent dans ~/breach-academy/.env
# sur le serveur (voir docs/DEPLOIEMENT.md).
#
# Usage : VPS=debian@<ip-ou-domaine> scripts/deploy-vps.sh
set -euo pipefail

: "${VPS:?Définir VPS, ex. VPS=debian@mon-vps scripts/deploy-vps.sh}"
APP_DIR="${APP_DIR:-breach-academy}"      # docker-compose.yml + .env (relatif au home)
SRC_DIR="${SRC_DIR:-breach-academy-src}"  # sources envoyées pour le build

cd "$(git rev-parse --show-toplevel)"
archive="$(mktemp -t breach-src.XXXXXX)"
trap 'rm -f "$archive"' EXIT

git ls-files -co --exclude-standard -z | tar czf "$archive" --null -T -
echo "→ Envoi des sources ($(du -h "$archive" | cut -f1))"
scp -q "$archive" "$VPS:/tmp/breach-src.tar.gz"

ssh "$VPS" APP_DIR="$APP_DIR" SRC_DIR="$SRC_DIR" bash -s <<'REMOTE'
set -euo pipefail
rm -rf "$HOME/$SRC_DIR" && mkdir -p "$HOME/$SRC_DIR"
tar xzf /tmp/breach-src.tar.gz -C "$HOME/$SRC_DIR" && rm /tmp/breach-src.tar.gz
echo "→ Build de l'image (Dockerfile multi-stage)"
sudo DOCKER_BUILDKIT=1 docker build -q -t breach-academy:local "$HOME/$SRC_DIR"
echo "→ Redémarrage du conteneur"
cd "$HOME/$APP_DIR"
sudo docker-compose up -d --force-recreate app
sudo docker image prune -f > /dev/null
REMOTE
echo "✓ Déployé"
