// ============================================================
// UNIFIED AUTH — api-error.ts  (v2)
//
// Philosophie :
//   • Les classes ne loggent RIEN — c'est le rôle du ExceptionFilter
//   • Une seule classe TypeORM avec un champ `op` au lieu de 10 classes
//   • Les messages internes (erreur DB) ne remontent JAMAIS au client
//   • `log` fonctionne vraiment
// ============================================================
import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { TypeORMError } from 'typeorm';

// ── Custom codes client ───────────────────────────────────────
// Format : HTTP_STATUS + discriminant à 2 chiffres
// Le client mobile utilise ces codes pour distinguer les cas
// sans parser le message texte.
export const ApiErrorCustomCode = {

    // ── Auth (1xxx) — universels, ne pas modifier ─────────────

    AUTH_API_KEY_MISSING: 1001,  // Clé API absente du header
    AUTH_API_KEY_INVALID: 1002,  // Clé API présente mais non reconnue

    AUTH_TOKEN_MISSING: 1003,  // JWT absent du header Authorization
    AUTH_TOKEN_INVALID: 1004,  // JWT présent mais malformé / mauvaise signature
    AUTH_TOKEN_EXPIRED: 1005,  // JWT expiré
    AUTH_TOKEN_REVOKED: 1006,  // JWT blacklisté (logout)

    AUTH_CREDENTIALS_INVALID: 1007,  // Email ou mot de passe incorrect
    AUTH_EMAIL_EXISTS: 1008,  // Email déjà utilisé à l'inscription
    AUTH_EMAIL_NOT_FOUND: 1009,  // Aucun compte avec cet email
    AUTH_EMAIL_NOT_VERIFIED: 1010,  // Compte non confirmé

    AUTH_OTP_INVALID: 1011,  // Code OTP incorrect
    AUTH_OTP_EXPIRED: 1012,  // Code OTP expiré

    AUTH_PIN_INVALID: 1013,  // PIN incorrect
    AUTH_PIN_NOT_CONFIGURED: 1014,  // PIN non configuré sur ce compte

    AUTH_ACCOUNT_BLOCKED: 1015,  // Compte bloqué
    AUTH_ACCOUNT_DELETED: 1016,  // Compte supprimé

    AUTH_TOO_MANY_ATTEMPTS: 1017,  // Trop de tentatives — compte temporairement verrouillé

    AUTH_ACCESS_DENIED: 1018,  // Rôle ou statut insuffisant
    AUTH_ADMIN_REQUIRED: 1019,  // Accès réservé aux admins / managers / engineers
    AUTH_AGENT_REQUIRED: 1020,  // Accès réservé aux agents

    // ── User (2xxx) — universels, ne pas modifier ─────────────

    USER_NOT_FOUND: 2001,  // Utilisateur introuvable par id
    USER_UPDATE_EMPTY: 2002,  // Aucun champ valide fourni pour la mise à jour

    // ── Métier (3xxx) — À COMPLÉTER SELON LE PROJET ──────────
    //
    // Exemples Paybuistra :
    // BUSINESS_AMOUNT_TOO_LOW:      3001,
    // BUSINESS_AMOUNT_TOO_HIGH:     3002,
    // BUSINESS_PHONE_INVALID:       3003,
    //
    // Exemples Ambassade :
    // BUSINESS_DOCUMENT_EXPIRED:    3001,
    // BUSINESS_APPOINTMENT_FULL:    3002,
    // BUSINESS_VISA_INVALID:        3003,

} as const;

// ── Types internes ────────────────────────────────────────────

export type ApiErrorLevel = 'error' | 'warn' | 'info';

/** Opérations TypeORM — pour contextualiser l'erreur dans les logs */
export type DbOp = 'find' | 'findOne' | 'create' | 'update' | 'delete' | 'query';

// ── Classe principale ─────────────────────────────────────────

export class ApiError extends HttpException {
    /** Message lisible par le client */
    readonly msg: string;

    /** Custom code discriminant pour le client mobile */
    readonly customCode?: number;

    /** Contexte métier optionnel retourné au client (ex: champ invalide) */
    readonly body?: unknown;

    /**
     * true → le msg est rédigé pour l'utilisateur final, le front peut l'afficher tel quel.
     * false → le msg est technique ou vague, le front doit agir selon customCode.
     */
    readonly displayable: boolean;

    /** Niveau de log — utilisé par le ExceptionFilter, pas ici */
    readonly level: ApiErrorLevel;

    /** true → le ExceptionFilter doit loguer cette erreur */
    readonly shouldLog: boolean;

    // ── Contexte debug (jamais envoyé au client) ──────────────

    /** Message interne précis — pour les logs uniquement, jamais exposé au client */
    readonly detail?: string;

    /** Entité TypeORM concernée — pour les logs */
    readonly entity?: string;

    /** Localisation dans le code — extraite automatiquement depuis la stack */
    readonly caller: { file?: string; class?: string; method?: string };

    constructor(
        msg: string,
        params?: {
            code?: HttpStatus;
            customCode?: number;
            body?: unknown;
            entity?: string;
            level?: ApiErrorLevel;
            shouldLog?: boolean;
            detail?: string;
            displayable?: boolean;
        },
    ) {
        const status = params?.code ?? HttpStatus.UNPROCESSABLE_ENTITY;
        super({ msg, body: params?.body }, status);

        this.msg = msg;
        this.customCode = params?.customCode;
        this.body = params?.body;
        this.displayable = params?.displayable ?? false;
        this.entity = params?.entity;
        this.level = params?.level ?? 'error';
        this.shouldLog = params?.shouldLog ?? false;
        this.detail = params?.detail;
        this.caller = ApiError.extractCaller();
    }

    private static extractCaller(): { file?: string; class?: string; method?: string } {
        const stack = new Error().stack;
        if (!stack) return {};

        const lines = stack.split('\n');
        // ligne 0 = "Error", 1 = ApiError constructor, 2 = sous-classe ou appelant
        const callerLine = lines[3] ?? lines[2] ?? '';
        const match = callerLine.match(/at\s+(.*)\s+\((.*):(\d+):\d+\)/);
        if (!match) return {};

        const parts = match[1].split('.');
        const file = match[2].split('/').pop();
        const method = parts.pop();
        const klass = parts.pop();

        return { file, class: klass, method };
    }
}

// ── Not found ─────────────────────────────────────────────────

export class ApiErrorNotFound extends ApiError {
    constructor(msg: string, entity?: string) {
        super(msg, { code: HttpStatus.NOT_FOUND, entity });
    }
}

export class ApiErrorNotFoundById extends ApiError {
    readonly id: string;

    constructor(entity: string, id: string) {
        super(`${entity} not found.`, {
            code: HttpStatus.NOT_FOUND,
            entity,
            shouldLog: false,
        });
        this.id = id;
    }
}

export class ApiErrorNotFoundOne extends ApiError {
    readonly label: string;
    readonly value: string;

    constructor(entity: string, label: string, value: string) {
        super(`${entity} not found.`, {
            code: HttpStatus.NOT_FOUND,
            entity,
            shouldLog: false,
        });
        this.label = label;
        this.value = value;
    }
}

// ── Erreurs TypeORM — une seule classe ────────────────────────
//
// Remplace : ApiErrorTypeOrmCreate, ApiErrorTypeOrmFind,
//            ApiErrorTypeOrmFindById, ApiErrorTypeOrmSearch,
//            ApiErrorTypeOrmUpdate, ApiErrorTypeOrmUpdateSearch,
//            ApiErrorTypeOrmList, ApiErrorTypeOrmDelete,
//            ApiErrorTypeOrmDeleteById, ApiErrorTypeOrmDeleteOne
//
// Usage :
//   throw new ApiErrorDb('users', 'create', body, err);
//   throw new ApiErrorDb('users', 'findOne', { id }, err);

export class ApiErrorDb extends ApiError {
    /** Opération qui a échoué — pour les logs uniquement */
    readonly op: DbOp;

    /** Données impliquées — pour les logs uniquement */
    readonly context?: unknown;

    /** Erreur TypeORM originale — pour les logs uniquement */
    readonly dbCause?: TypeORMError | Error | unknown;

    constructor(
        entity: string,
        op: DbOp,
        context?: unknown,
        dbCause?: TypeORMError | Error | unknown,
    ) {
        // Message générique côté client — jamais de détail DB
        super('An error occurred. Please try again or contact support.', {
            code: HttpStatus.INTERNAL_SERVER_ERROR,
            entity,
            level: 'error',
            shouldLog: true,   // toujours loggué
        });
        this.op = op;
        this.context = context;
        this.dbCause = dbCause;
    }
}

// ── Validation (class-validator) ──────────────────────────────

export class AppValidationError extends BadRequestException {
    readonly type = 'VALIDATION';
    readonly msg = 'Validation failed';
    readonly validations: Record<string, unknown>;

    constructor(validations: Record<string, unknown>) {
        super();
        this.validations = validations;
    }
}

// ── Mapper class-validator → AppValidationError ───────────────

export function errorMapper(errors: ValidationError[]): AppValidationError {
    const validations: Record<string, unknown> = {};

    function mapChildren(error: ValidationError): unknown {
        if (error.children?.length) {
            const nested: Record<string, unknown> = {};
            for (const child of error.children) {
                nested[child.property] = mapChildren(child);
            }
            return nested;
        }
        if (error.constraints) {
            return Object.values(error.constraints);
        }
        return ['Invalid value.'];
    }

    for (const error of errors) {
        validations[error.property] = mapChildren(error);
    }

    return new AppValidationError(validations);
}