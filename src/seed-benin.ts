// ============================================================
// seed-benin.ts
// Entrypoint CLI dédié au seed du découpage administratif du Bénin
// (Country / Region = Commune / Zone = Arrondissement). Indépendant
// de src/seeder.ts (admin + compte de test) — voir la note « Script
// séparé » : ces ~625 lignes de référence ne sont pas rejouées à
// chaque `npm run seed`.
//
// Nécessite les migrations déjà appliquées (npm run migration:run).
//
// Usage :
//   npm run seed:benin          — idempotent (skip si le pays BJ existe)
//   npm run seed:benin:refresh  — supprime le Bénin (cascade) puis recrée
// ============================================================
import 'dotenv/config';
import dataSource from './database/data-source';
import { seedBeninAddress } from './database/seeds/seed-benin-address';

async function run(): Promise<void> {
  const refresh = process.argv.includes('--refresh');

  await dataSource.initialize();
  try {
    await seedBeninAddress(dataSource, refresh);
  } finally {
    await dataSource.destroy();
  }
}

run().catch((err) => {
  console.error('Échec du seed Bénin :', err);
  process.exit(1);
});
