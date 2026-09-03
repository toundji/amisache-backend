// ============================================================
// UNIFIED AUTH — redis.config.ts
// Configuration Redis par opération.
// Chaque opération a son propre profil de risque.
// ============================================================

export interface RedisOperationConf {
    /** Nombre max de tentatives avant lock */
    maxAttempts: number;
    /** Durée du lock en secondes */
    lockDuration: number;
    /** Durée du lock en minutes (pour les messages d'erreur) */
    lockMinutes: number;
    /** TTL de l'OTP en secondes (null si pas d'OTP) */
    otpTtl: number | null;
}

export const redisConf: Record<string, RedisOperationConf> = {

    /**
     * Login — risque élevé (brute force mot de passe)
     * 5 tentatives puis lock 15min
     */
    login: {
        maxAttempts: 5,
        lockDuration: 900,
        lockMinutes: 15,
        otpTtl: null,
    },

    /**
     * Confirmation email — risque moyen (6 chiffres = 1M possibilités)
     * 5 tentatives puis lock 10min
     */
    confirm: {
        maxAttempts: 5,
        lockDuration: 600,
        lockMinutes: 10,
        otpTtl: 600,
    },

    /**
     * Reset password — risque moyen mais accès critique
     * 3 tentatives puis lock 30min
     */
    reset: {
        maxAttempts: 3,
        lockDuration: 1800,
        lockMinutes: 30,
        otpTtl: 600,
    },

    /**
     * PIN — risque élevé (4-6 chiffres, facile à deviner)
     * 3 tentatives puis lock 1h
     */
    pin: {
        maxAttempts: 3,
        lockDuration: 3600,
        lockMinutes: 60,
        otpTtl: null,
    },

};

/**
 * Structure des clés Redis
 * ─────────────────────────────────────────────────────────
 * otp:{operation}:{userId}    → le code OTP
 * att:{operation}:{userId}    → compteur de tentatives
 * lock:{operation}:{userId}   → verrou temporaire
 * jti:{jti}                   → access token révoqué (logout)
 *
 * On utilise toujours userId (immuable) comme identifiant.
 * Jamais l'email (mutable).
 *
 * Exception — opération "login" :
 *   L'email est utilisé comme identifiant (pas l'userId) car :
 *   1. Le lock est vérifié AVANT la requête DB — l'userId n'est pas encore connu
 *   2. L'attaquant cible un compte via son email — le lock doit se poser sur la même clé
 *   incrementAttempt et resetAttempts utilisent donc tous les deux body.username (email).
 */
export const redisKeys = {
    otp: (op: string, userId: string) => `otp:${op}:${userId}`,
    att: (op: string, userId: string) => `att:${op}:${userId}`,
    lock: (op: string, userId: string) => `lock:${op}:${userId}`,
    jti: (jti: string) => `jti:${jti}`,
};

/** TTL du refresh token en secondes (7 jours) */
export const REFRESH_TOKEN_TTL = 60 * 60 * 24 * 7;

/** TTL du jti au logout = durée max d'un access token admin */
export const JTI_BLACKLIST_TTL = 60 * 60 * 8; // 8h (durée max access token admin)