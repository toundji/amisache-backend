// ============================================================
// seed-admin.ts
// Seed de l'admin principal. Logique isolée de l'entrypoint CLI
// (src/seeder.ts) pour rester facile à tester et à réutiliser
// quand d'autres seeds s'ajouteront à côté de celui-ci.
// ============================================================
import { DataSource } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { UserRole, UserStatus } from '../../shared/common.enum';
import { apiHashPassword } from '../../utils/api-util';

export interface SeedAdminConfig {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
}

/**
 * Lit et valide la config depuis .env — appelée avant toute connexion DB
 * pour échouer vite en cas de configuration incomplète/invalide.
 */
export function readSeedAdminConfig(): SeedAdminConfig {
    const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.SEED_ADMIN_PASSWORD;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error('SEED_ADMIN_EMAIL manquant ou invalide dans .env.');
    }
    if (!password || password.length < 8) {
        throw new Error('SEED_ADMIN_PASSWORD manquant ou trop court (8 caractères minimum) dans .env.');
    }

    return {
        email,
        password,
        firstName: process.env.SEED_ADMIN_FIRST_NAME ?? 'Admin',
        lastName: process.env.SEED_ADMIN_LAST_NAME ?? 'Système',
    };
}

export async function seedAdmin(dataSource: DataSource, refresh: boolean): Promise<void> {
    const config = readSeedAdminConfig();
    const userRepo = dataSource.getRepository(User);

    const existing = await userRepo.findOne({ where: { email: config.email } });

    if (existing && !refresh) {
        console.log(`Admin principal déjà présent (${config.email}) — seed ignoré.`);
        return;
    }

    if (existing && refresh) {
        // Hard delete (pas softDelete) : libère la contrainte unique sur l'email
        // pour permettre la recréation immédiate.
        await userRepo.delete(existing.id);
    }

    const admin = userRepo.create({
        email: config.email,
        password: apiHashPassword(config.password),
        firstName: config.firstName,
        lastName: config.lastName,
        status: UserStatus.active,
        roles: [UserRole.admin],
    });

    await userRepo.save(admin);
    console.log(`Admin principal créé : ${config.email}`);
}
