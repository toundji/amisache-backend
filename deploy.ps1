# ===============================
# Script de déploiement Angular
# ===============================

# ✅ Correction de l'encodage pour PowerShell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# Configuration générale
$AppName = "amisachews"
$RemoteServer = "180.149.199.113"   # Adresse IP ou domaine du serveur
$RemoteUser = "root"              # Utilisateur SSH
$RemotePath = "/home/amisache/webservice"  # Chemin distant
$BuildPath = "dist"      # Dossier de build Angular
$MAIN_FILE = "dist/main.js"
$URL = "http://api.nutito.org/docs"
$URLS = "https://api.nutito.org/docs"

# 👇 Nom de ta base MySQL — à adapter
$DbName = "c0amisache_db"

# 👇 Fichier .env local à envoyer sur le serveur (renommé en .env côté distant)
$LocalEnvFile = ".env.prod"



Write-Host "=== Déploiement de l'application Nestjs: $AppName ===" -ForegroundColor Cyan

# 1. Lancer le build NestJs
Write-Host "-> Lancement du build NestJs..." -ForegroundColor Yellow
npm run build 
if ($LASTEXITCODE -ne 0) {
  Write-Host "❌ Erreur lors du build NestJs." -ForegroundColor Red
  exit 1
}
Write-Host "✅ Build NestJs terminé." -ForegroundColor Green



# 1bis. Backup de la base AVANT toute modification/redémarrage — filet de sécurité
#       en attendant la mise en place de vraies migrations TypeORM (synchronize: true
#       reste actif pour l'instant, donc chaque redémarrage PM2 est un point de risque).
Write-Host "-> Sauvegarde de la base de données distante..." -ForegroundColor Yellow
$backupFile = "backups/backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"
ssh "${RemoteUser}@${RemoteServer}" "mkdir -p ${RemotePath}/backups && mysqldump ${DbName} > ${RemotePath}/${backupFile}"
if ($LASTEXITCODE -ne 0) {
  Write-Host "⚠️ Échec de la sauvegarde — déploiement interrompu par précaution." -ForegroundColor Red
  exit 1
}
Write-Host "✅ Sauvegarde créée : ${RemotePath}/${backupFile}" -ForegroundColor Green



# 2. 
Write-Host "-> Nettoyage de l'ancien build sur le serveur..." -ForegroundColor Yellow
ssh "${RemoteUser}@${RemoteServer}" "rm -rf ${RemotePath}/${BuildPath}"


# 3. 
Write-Host "-> Vérification de la nécessité d'installer les dépendances..." -ForegroundColor Yellow

# Calculer le hash local — MD5 pour être comparable au md5sum distant
# (Get-FileHash utilise SHA256 par défaut : comparer directement avec md5sum
# aurait toujours été un mismatch, forçant un npm install à chaque déploiement)
$localHash = (Get-FileHash "./package-lock.json" -Algorithm MD5).Hash.ToLower()

# Récupérer le hash distant
# `$1 : le backtick empêche PowerShell d'interpoler $1 avant l'envoi à ssh —
# sans lui, awk recevait littéralement "\$1" et plantait côté distant.
$remoteHash = (ssh "${RemoteUser}@${RemoteServer}" "md5sum ${RemotePath}/package-lock.json 2>/dev/null | awk '{print `$1}'").Trim().ToLower()

if ($localHash -ne $remoteHash) {
  Write-Host "📦 package-lock.json a changé, installation des dépendances..." -ForegroundColor Cyan
  $NeedInstall = $true
}
else {
  Write-Host "✅ Les dépendances sont à jour, skip npm install." -ForegroundColor Green
  $NeedInstall = $false
}



# 2. Copier les fichiers vers le serveur distant
Write-Host "-> Copie des fichiers du build vers le serveur distant..." -ForegroundColor Yellow

scp -r "$BuildPath" "${RemoteUser}@${RemoteServer}:${RemotePath}"
scp -r "public/assets" "${RemoteUser}@${RemoteServer}:${RemotePath}/public"
scp -r "swagger.json" "${RemoteUser}@${RemoteServer}:${RemotePath}"

if ($LASTEXITCODE -ne 0) {
  Write-Host "❌ Erreur lors du transfert des fichiers." -ForegroundColor Red
  exit 1
}

# Envoyer .env uniquement s'il n'existe pas encore côté distant — on ne veut
# jamais écraser silencieusement des secrets déjà en place sur le serveur.
Write-Host "-> Vérification de la présence de .env sur le serveur..." -ForegroundColor Yellow
ssh "${RemoteUser}@${RemoteServer}" "test -f ${RemotePath}/.env"
if ($LASTEXITCODE -ne 0) {
  Write-Host "📤 .env absent côté distant, envoi de $LocalEnvFile..." -ForegroundColor Cyan
  scp "./$LocalEnvFile" "${RemoteUser}@${RemoteServer}:${RemotePath}/.env"
  if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur lors de l'envoi de $LocalEnvFile." -ForegroundColor Red
    exit 1
  }
  Write-Host "✅ .env envoyé." -ForegroundColor Green
}
else {
  Write-Host "✅ .env déjà présent sur le serveur, pas d'écrasement." -ForegroundColor Green
}


# Initialisation de la commande distante (toujours défini, même sans install)
$remoteCommand = ""

if ($NeedInstall) {
  Write-Host "-> Nettoyage de l'ancien build sur le serveur..." -ForegroundColor Yellow
  ssh "${RemoteUser}@${RemoteServer}" "rm ${RemotePath}/packag*.json"
  scp -r "./package.json" "./package-lock.json" "${RemoteUser}@${RemoteServer}:${RemotePath}"


  $remoteCommand += @"
echo '📦 Installation des dépendances...'
cd $RemotePath
npm i --legacy-peer-deps
"@
}



# 3. Exécuter les commandes sur le serveur distant
Write-Host "-> Exécution des commandes sur le serveur distant..." -ForegroundColor Yellow

# 🔑 Jointure explicite avec un saut de ligne : évite tout risque de collage
# entre le dernier mot du bloc précédent et le premier mot de celui-ci
# (ex: "npm i" + "cd ..." => "npm icd ..." si on oublie le `n)
$remoteCommand += "`n" + @"
cd $RemotePath
pm2 list | grep $AppName >/dev/null 2>&1

if [ `$? -eq 0 ]; then
  echo '🔄 Redémarrage de l'\''application avec PM2...'
  pm2 restart $AppName
else
  echo '🚀 Première exécution de l'\''application avec PM2...'
  pm2 start $MAIN_FILE --name $AppName
fi
pm2 save
pm2 status $AppName
"@



# 🧹 Supprimer les retours chariots Windows avant d'envoyer
$remoteCommand = $remoteCommand -replace "`r", ""

# 🔍 Debug : afficher la commande distante avant exécution
Write-Host "----- COMMANDE DISTANTE -----" -ForegroundColor DarkGray
Write-Host $remoteCommand -ForegroundColor DarkGray
Write-Host "------------------------------" -ForegroundColor DarkGray

ssh "${RemoteUser}@${RemoteServer}" $remoteCommand

if ($LASTEXITCODE -ne 0) {
  Write-Host "❌ Erreur lors de l'exécution distante." -ForegroundColor Red
  exit 1
}

Write-Host "✅ Déploiement terminé avec succès !" -ForegroundColor Green
Write-Host $URL $URLS  -ForegroundColor Green
