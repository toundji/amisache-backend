#!/usr/bin/env bash
# scripts/remote-deploy.sh — exécuté sur le VPS par la CI ou par deploy.ps1
# Usage : remote-deploy.sh <prod|test> <release>
#
# Arborescence attendue (dans le $HOME de l'utilisateur SSH) :
#   api-<env>/releases/<release>/   code de chaque release
#   api-<env>/shared/.env           secrets (jamais dans une release)
#   api-<env>/shared/storage/       fichiers uploadés -> public/storage
#   api-<env>/backups/              dumps MySQL pris avant chaque migration
#   api-<env>/current               symlink vers la release active
set -euo pipefail

# Node/pm2 viennent de nvm : un shell SSH non interactif ne charge pas .bashrc
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
command -v pm2 >/dev/null || { echo "ERREUR : pm2 introuvable pour $(whoami)"; exit 1; }

ENV="${1:?env manquant (prod|test)}"
REL="${2:?release manquante}"
BASE="$HOME/api-$ENV"
REL_DIR="$BASE/releases/$REL"
APP="amisache-$ENV"
KEEP=5
KEEP_BACKUPS=10
MIGRATIONS_DS="dist/database/data-source.js"
HEALTH_PATH="${HEALTH_PATH:-/}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] $*"; }
# Exécute une commande en horodatant chaque ligne de sa sortie (le code de retour est conservé via pipefail)
run() { "$@" 2>&1 | while IFS= read -r line; do log "  $line"; done; }
# Lit une variable de shared/.env (dernière occurrence, espaces/\r de fin et guillemets retirés)
envget() {
  grep -E "^$1=" "$BASE/shared/.env" | tail -n1 | cut -d= -f2- \
    | sed -e 's/[[:space:]]*$//' -e 's/^["'\'']//' -e 's/["'\'']$//' || true
}

[ -d "$REL_DIR" ] || { echo "Release introuvable : $REL_DIR"; exit 1; }
[ -f "$BASE/shared/.env" ] || { echo "ERREUR : $BASE/shared/.env absent. Crée-le avant de déployer."; exit 1; }
cd "$REL_DIR"

# 1. Liens vers shared/ (.env, …)
log "Liens shared/"
shopt -s dotglob nullglob
for item in "$BASE"/shared/*; do
  ln -sfn "$item" "$REL_DIR/$(basename "$item")"
done
shopt -u dotglob nullglob

# Données dynamiques : public/storage de la release pointe vers shared/storage
# (public/assets, statique, vient de la release elle-même)
mkdir -p "$BASE/shared/storage" "$REL_DIR/public"
rm -rf "$REL_DIR/public/storage"
ln -sfn "$BASE/shared/storage" "$REL_DIR/public/storage"
rm -f "$REL_DIR/storage"   # pas de doublon à la racine créé par la boucle ci-dessus

# 2. Dépendances de prod
#    Si package-lock.json est identique à la release active, on réutilise
#    son node_modules (hardlinks, instantané) au lieu de réinstaller.
CUR_REL="$(readlink -f "$BASE/current" 2>/dev/null || true)"
if [ -n "$CUR_REL" ] && [ -d "$CUR_REL/node_modules" ] \
   && cmp -s "$CUR_REL/package-lock.json" "$REL_DIR/package-lock.json"; then
  log "package-lock inchangé : réutilisation de node_modules"
  cp -al "$CUR_REL/node_modules" "$REL_DIR/node_modules"
else
  log "npm ci"
  run npm ci --omit=dev --no-audit --no-fund
fi

# 3. Sauvegarde MySQL — obligatoire : aucun dump, aucune migration.
#    Le rollback automatique (étape 6) ne restaure que le code, jamais la base.
DB_HOST="$(envget DB_HOST)"; DB_PORT="$(envget DB_PORT)"
DB_USER="$(envget DB_USER)"; DB_PASS="$(envget DB_PASS)"; DB_NAME="$(envget DB_NAME)"
[ -n "$DB_NAME" ] || { echo "ERREUR : DB_NAME absent de shared/.env"; exit 1; }
mkdir -p "$BASE/backups"
BACKUP="$BASE/backups/${DB_NAME}_${REL}.sql.gz"
log "Sauvegarde $DB_NAME -> $BACKUP"
MYSQL_PWD="$DB_PASS" mysqldump \
  -h "${DB_HOST:-localhost}" -P "${DB_PORT:-3306}" -u "${DB_USER:-root}" \
  --single-transaction --triggers --no-tablespaces \
  "$DB_NAME" | gzip > "$BACKUP" \
  || { rm -f "$BACKUP"; echo "ERREUR : échec du mysqldump, déploiement interrompu."; exit 1; }
[ -s "$BACKUP" ] || { echo "ERREUR : sauvegarde vide, déploiement interrompu."; exit 1; }
ls -1t "$BASE"/backups/*.sql.gz | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -f

# 4. Migrations (data-source lit .env depuis le cwd = la release)
log "Migrations"
run npx typeorm migration:run -d "$MIGRATIONS_DS"

# 5. Bascule atomique du symlink current
PREV="$(readlink -f "$BASE/current" 2>/dev/null || true)"
log "Bascule current -> $REL"
ln -sfn "$REL_DIR" "$BASE/current.tmp"
mv -Tf "$BASE/current.tmp" "$BASE/current"

# 6. (Re)démarrage pm2
log "pm2 $APP"
run pm2 startOrReload "$BASE/current/ecosystem.config.js" --only "$APP" --update-env

# 7. Health check + rollback automatique du code
PORT="$(envget PORT | tr -d '[:space:]')"
ok=0
for i in $(seq 1 15); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT$HEALTH_PATH" || echo 000)"
  if [ "$code" != "000" ] && [ "$code" -lt 500 ]; then ok=1; break; fi
  sleep 2
done

if [ "$ok" -ne 1 ]; then
  log "ÉCHEC health check (dernier code: $code)"
  if [ -n "$PREV" ] && [ -d "$PREV" ]; then
    log "Rollback -> $(basename "$PREV")"
    ln -sfn "$PREV" "$BASE/current.tmp"
    mv -Tf "$BASE/current.tmp" "$BASE/current"
    run pm2 startOrReload "$BASE/current/ecosystem.config.js" --only "$APP" --update-env
  fi
  log "La base n'a PAS été restaurée. Si une migration est en cause : $BACKUP"
  exit 1
fi

pm2 save >/dev/null
log "OK : $APP tourne sur $REL (port $PORT)"

# 8. Nettoyage : garde les $KEEP plus récentes, jamais la release active
CUR="$(readlink -f "$BASE/current")"
ls -1dt "$BASE"/releases/*/ | tail -n +$((KEEP + 1)) | while read -r d; do
  [ "$(readlink -f "$d")" = "$CUR" ] || rm -rf "$d"
done
