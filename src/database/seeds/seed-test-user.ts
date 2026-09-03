// ============================================================
// seed-test-user.ts
// Seed OPTIONNEL d'un compte de test E2E (Playwright & co.).
// Même gabarit que seed-admin.ts, avec deux différences :
//   • entièrement optionnel — ne fait rien si SEED_TEST_USER_EMAIL est vide ;
//   • refuse de s'exécuter en production sauf SEED_TEST_USER_ALLOW_PROD=true
//     (un compte à mot de passe connu n'a rien à faire en prod).
// Le compte est créé avec status=active → login direct, sans passer par
// le flux OTP de confirmation email.
// ============================================================
import { DataSource } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { UserRole, UserStatus } from '../../shared/common.enum';
import { apiHashPassword } from '../../utils/api-util';

export interface SeedTestUserConfig {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    roles: UserRole[];
}

/**
 * Lit et valide la config depuis .env — appelée avant toute connexion DB
 * pour échouer vite. Retourne `null` si le seed n'est pas configuré
 * (SEED_TEST_USER_EMAIL absent) : dans ce cas le seed est simplement ignoré.
 */
export function readSeedTestUserConfig(): SeedTestUserConfig | null {
    const rawEmail = process.env.SEED_TEST_USER_EMAIL?.trim();
    if (!rawEmail) return null; // non configuré → seed ignoré

    const email = rawEmail.toLowerCase();
    const password = process.env.SEED_TEST_USER_PASSWORD;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error('SEED_TEST_USER_EMAIL invalide dans .env.');
    }
    if (!password || password.length < 8) {
        throw new Error('SEED_TEST_USER_PASSWORD manquant ou trop court (8 caractères minimum) dans .env.');
    }

    const roles = (process.env.SEED_TEST_USER_ROLES ?? UserRole.user)
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean) as UserRole[];

    const unknown = roles.filter((r) => !Object.values(UserRole).includes(r));
    if (unknown.length > 0) {
        throw new Error(`SEED_TEST_USER_ROLES contient un rôle inconnu : ${unknown.join(', ')}.`);
    }

    return {
        email,
        password,
        firstName: process.env.SEED_TEST_USER_FIRST_NAME ?? 'Test',
        lastName: process.env.SEED_TEST_USER_LAST_NAME ?? 'E2E',
        roles: roles.length > 0 ? roles : [UserRole.user],
    };
}

export async function seedTestUser(dataSource: DataSource, refresh: boolean): Promise<void> {
    const config = readSeedTestUserConfig();
    if (!config) return; // non configuré

    const isProd = (process.env.NODE_ENV ?? 'development') === 'production';
    if (isProd && process.env.SEED_TEST_USER_ALLOW_PROD !== 'true') {
        console.warn(
            'Compte de test E2E ignoré : NODE_ENV=production et SEED_TEST_USER_ALLOW_PROD !== "true".',
        );
        return;
    }

    const userRepo = dataSource.getRepository(User);
    const existing = await userRepo.findOne({ where: { email: config.email } });

    if (existing && !refresh) {
        console.log(`Compte de test déjà présent (${config.email}) — seed ignoré.`);
        return;
    }

    if (existing && refresh) {
        // Hard delete : libère la contrainte unique sur l'email pour recréer.
        await userRepo.delete(existing.id);
    }

    const user = userRepo.create({
        email: config.email,
        password: apiHashPassword(config.password),
        firstName: config.firstName,
        lastName: config.lastName,
        status: UserStatus.active, // déjà vérifié → pas de flux OTP au login
        roles: config.roles,
    });

    await userRepo.save(user);
    console.log(`Compte de test E2E créé : ${config.email} (${config.roles.join(', ')})`);
}
