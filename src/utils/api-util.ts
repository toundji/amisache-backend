





// ============================================================
// UNIFIED AUTH — api-util.ts
// Utilitaires cryptographiques et helpers JWT.
// ============================================================
import * as crypto from 'crypto';
import 'dotenv/config';
import { compareSync, hashSync } from 'bcrypt';
import { ApiClientType, DeviceType, TokenType, UserRole, UserStatus } from '../shared/common.enum';

// ── Constantes ───────────────────────────────────────────────

const BCRYPT_ROUNDS = 12;
const AES_ALGO = 'aes-256-gcm';

function getCryptoKey(): Buffer {
    const key = process.env.CRYPTO_KEY ?? '';
    if (key.length !== 64) {
        throw new Error(`CRYPTO_KEY must be 64 hex chars (32 bytes). Got ${key.length}`);
    }
    return Buffer.from(key, 'hex');
}

// ── OTP ──────────────────────────────────────────────────────

/**
 * Génère un OTP 6 chiffres via crypto.randomInt (CSPRNG).
 * Math.random() est interdit ici — non cryptographiquement sûr.
 */
export function apiGenerateOtp(): string {
    return `${crypto.randomInt(100_000, 1_000_000)}`;
}

// ── AES-256-GCM ───────────────────────────────────────────────

/**
 * Chiffre une chaîne avec AES-256-GCM (authentifié).
 * Format : <iv:24hex><authTag:32hex><ciphertext:hex>
 */
export function apiWordCrypt(data: string): string {
    const key = getCryptoKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(AES_ALGO, key, iv) as crypto.CipherGCM;

    let encrypted = cipher.update(data, 'utf-8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return iv.toString('hex') + authTag + encrypted;
}

export function apiWordDecrypt(encryptedData: string): string {
    const key = getCryptoKey();
    const iv = Buffer.from(encryptedData.slice(0, 24), 'hex');
    const authTag = Buffer.from(encryptedData.slice(24, 56), 'hex');
    const cipher = encryptedData.slice(56);

    const decipher = crypto.createDecipheriv(AES_ALGO, key, iv) as crypto.DecipherGCM;
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(cipher, 'hex', 'utf-8');
    decrypted += decipher.final('utf-8');
    return decrypted;
}

export function apiJsonCrypt(data: unknown): string {
    return apiWordCrypt(JSON.stringify(data));
}

export function apiJsonDecrypt<T = unknown>(encryptedData: string): T {
    return JSON.parse(apiWordDecrypt(encryptedData)) as T;
}

// ── Password ─────────────────────────────────────────────────

export function apiHashPassword(password: string): string {
    return hashSync(password, BCRYPT_ROUNDS);
}

export function apiComparePasswords(password: string, hash: string): boolean {
    return compareSync(password, hash);
}

// ── JWT Payload ───────────────────────────────────────────────

export interface JwtPayload {
    sub: string;
    email: string;
    status?: UserStatus;
    roles: UserRole[];
    type: TokenType;
    jti: string;
    dfp: string; // deviceFingerprint — abrégé pour minimiser la taille du token
}

/** Sous-ensemble structurel de User requis pour signer un JWT. utils/ ne dépend que de shared/. */
export interface JwtPayloadUser {
    id: string;
    email?: string;
    status?: UserStatus;
    roles?: UserRole[];
}

/**
 * Payload JWT minimal.
 * - sub    : userId (standard RFC 7519)
 * - email  : pour les logs uniquement
 * - status : pour RequireUserStatusGuard sans requête DB
 * - roles  : pour les guards sans DB
 * - type   : évite confusion access/refresh
 * - jti    : pour révocation au logout via Redis
 * - dfp    : deviceFingerprint — pour cibler la session au logout
 */
export function apiGeneratePayLoad(user: JwtPayloadUser, type: TokenType, deviceFingerprint: string): JwtPayload {
    return {
        sub: user.id,
        email: user.email ?? '',
        roles: user.roles ?? [],
        status: user.status ?? undefined,
        type,
        jti: crypto.randomUUID(),
        dfp: deviceFingerprint,
    };
}

// ── Refresh token ─────────────────────────────────────────────

/** Hash SHA-256 du refresh token pour stockage en base */
export function hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

// ── Device fingerprint ────────────────────────────────────────

/**
 * Empreinte unique par équipement.
 * Hash SHA-256 de (userId + deviceName + os + deviceType).
 * Permet l'upsert sans doublon.
 */
export function generateDeviceFingerprint(
    userId: string,
    deviceName: string,
    os: string,
    deviceType: string,
): string {
    return crypto
        .createHash('sha256')
        .update(`${userId}:${deviceName}:${os}:${deviceType}`)
        .digest('hex');
}

// ── Device detection ──────────────────────────────────────────

const DeviceDetector = require('node-device-detector');

export interface ParsedDevice {
    deviceName: string;
    deviceType: DeviceType;
    os: string;
    browser: string | null;
    fingerprint: string;
}

export function parseUserAgent(userAgent: string, userId: string): ParsedDevice {
    try {
        const detector = new DeviceDetector({
            clientIndexes: true,
            deviceIndexes: true,
            maxUserAgentSize: 500,
        });

        const result = detector.detect(userAgent);
        const os = result.os;
        const client = result.client;
        const device = result.device;

        const deviceName = device?.model
            ? `${device.brand ?? ''} ${device.model}`.trim()
            : (client?.name ?? 'Unknown Device');

        const osStr = os?.name
            ? `${os.name}${os.version ? ` ${os.version}` : ''}`
            : 'Unknown OS';

        const browser = client?.type === 'browser' ? client.name ?? null : null;

        let deviceType: DeviceType;
        switch (device?.type) {
            case 'smartphone': deviceType = DeviceType.mobile; break;
            case 'tablet': deviceType = DeviceType.tablet; break;
            case 'desktop': deviceType = DeviceType.desktop; break;
            default: deviceType = DeviceType.unknown;
        }

        const fingerprint = generateDeviceFingerprint(userId, deviceName, osStr, deviceType);

        return { deviceName, deviceType, os: osStr, browser, fingerprint };
    } catch {
        const fingerprint = generateDeviceFingerprint(userId, 'Unknown', 'Unknown', DeviceType.unknown);
        return {
            deviceName: 'Unknown Device',
            deviceType: DeviceType.unknown,
            os: 'Unknown OS',
            browser: null,
            fingerprint,
        };
    }
}

// ── API Key ───────────────────────────────────────────────────

export function getApiClientType(apiKey: string): ApiClientType | null {
    const map: Record<string, ApiClientType> = {
        [process.env.API_KEY_MOBILE ?? '_']: ApiClientType.mobile,
        [process.env.API_KEY_IOS ?? '_']: ApiClientType.ios,
        [process.env.API_KEY_MANAGER ?? '_']: ApiClientType.manager,
        [process.env.API_KEY_WEB_APP ?? '_']: ApiClientType.web_app,
        [process.env.API_KEY_LANDING ?? '_']: ApiClientType.landing,
        [process.env.API_KEY_WEB ?? '_']: ApiClientType.web,
        [process.env.API_KEY_WEBSITE ?? '_']: ApiClientType.website,
        [process.env.API_KEY_BACK_OFFICE ?? '_']: ApiClientType.back_office,
        [process.env.API_KEY_SWAGGER ?? '_']: ApiClientType.swagger,
    };
    return map[apiKey] ?? null;
}

// ── Helpers ───────────────────────────────────────────────────

export function isAdminRole(roles: string[]): boolean {
    return ['admin', 'manager', 'engineer'].some(r => roles.includes(r));
}


