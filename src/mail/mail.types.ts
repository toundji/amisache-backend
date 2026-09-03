// ============================================================
// UNIFIED AUTH — mail.types.ts
// Interfaces des jobs email pour BullMQ.
// ============================================================

/**
 * Sous-ensemble structurel de User utilisé par MailService.
 * mail/ ne dépend d'aucun autre module métier (shared, utils uniquement) :
 * on type sur la forme requise plutôt que d'importer l'entité User.
 */
export interface MailRecipient {
    email?: string;
    firstName?: string;
}

export enum MailJobType {
    CONFIRM_EMAIL = 'confirm-email',
    RESET_PASSWORD = 'reset-password',
    RESET_PIN = 'reset-pin',
    RESET_LINK = 'reset-link',
    CONTACT_NOTIFY = 'contact-notify',
    CONTACT_ACK = 'contact-ack',
}

export interface MailJobBase {
    type: MailJobType;
    to: string;
    firstName: string;
    /**
     * Présent uniquement si le job est une relance manuelle.
     * Contient l'id de l'entrée mail_failed_jobs d'origine.
     * Utilisé par onJobFailed pour mettre à jour l'entrée existante
     * au lieu d'en créer une nouvelle.
     */
    _retriedFromId?: string;
}

export interface ConfirmEmailJob extends MailJobBase {
    type: MailJobType.CONFIRM_EMAIL;
    otp: string;
    expiry: number; // minutes
}

export interface ResetPasswordJob extends MailJobBase {
    type: MailJobType.RESET_PASSWORD;
    otp: string;
    expiry: number;
}

export interface ResetPinJob extends MailJobBase {
    type: MailJobType.RESET_PIN;
    otp: string;
    expiry: number;
}

export interface ResetLinkJob extends MailJobBase {
    type: MailJobType.RESET_LINK;
    resetUrl: string;
    expiry: number; // heures
}

/** Notification envoyée à l'admin quand un formulaire de contact est soumis. */
export interface ContactNotifyJob extends MailJobBase {
    type: MailJobType.CONTACT_NOTIFY;
    senderName: string;
    senderEmail: string;
    subject?: string;
    message: string;
}

/** Accusé de réception envoyé à l'expéditeur du formulaire de contact. */
export interface ContactAckJob extends MailJobBase {
    type: MailJobType.CONTACT_ACK;
    subject?: string;
}

export type MailJob =
    | ConfirmEmailJob
    | ResetPasswordJob
    | ResetPinJob
    | ResetLinkJob
    | ContactNotifyJob
    | ContactAckJob;

export const MAIL_QUEUE = 'mail-queue';