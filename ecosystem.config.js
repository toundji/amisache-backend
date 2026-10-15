// ecosystem.config.js — app pm2 du VPS (utilisé par scripts/remote-deploy.sh)
// cwd pointe sur le symlink `current` : chaque reload démarre la release active.
// Pas de variables d'env ici : shared/.env (lu par ConfigModule) fait foi.
const path = require('path');

const app = (env) => ({
  name: `amisache-${env}`,
  cwd: path.join(process.env.HOME, `api-${env}`, 'current'),
  script: 'dist/main.js',
  exec_mode: 'fork',
  instances: 1,
  max_memory_restart: '800M',
  time: true,
});

module.exports = {
  apps: [app('test'), app('prod')],
};
