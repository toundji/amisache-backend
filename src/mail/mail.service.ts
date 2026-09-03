// ============================================================
// UNIFIED AUTH — mail.service.ts
// Ajoute les jobs email dans la queue BullMQ.
// N'envoie PAS directement — délègue au worker.
//
// Avantage : la réponse au client est immédiate.
// L'email est envoyé en arrière-plan par mail.processor.ts
// ============================================================
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue }       from 'bullmq';

import {
    MAIL_QUEUE, MailJobType, MailRecipient,
    ConfirmEmailJob, ResetPasswordJob,
    ResetPinJob, ResetLinkJob,
    ContactNotifyJob, ContactAckJob,
} from './mail.types';

@Injectable()
export class MailService {

    constructor(
        @InjectQueue(MAIL_QUEUE) private readonly mailQueue: Queue,
    ) {}

    // ── Confirmation email ────────────────────────────────────

    async sendUserConfirmation(user: MailRecipient, otp: string): Promise<void> {
        const job: ConfirmEmailJob = {
            type:      MailJobType.CONFIRM_EMAIL,
            to:        user.email!,
            firstName: user.firstName ?? 'Utilisateur',
            otp,
            expiry:    10,
        };
        await this.mailQueue.add(MailJobType.CONFIRM_EMAIL, job, {
            attempts:  3,
            backoff:   { type: 'exponential', delay: 5000 },
            removeOnComplete: 100,
            removeOnFail:     50,
        });
    }

    // ── Reset password (OTP) ──────────────────────────────────

    async sendResetPasswordCode(user: MailRecipient, otp: string): Promise<void> {
        const job: ResetPasswordJob = {
            type:      MailJobType.RESET_PASSWORD,
            to:        user.email!,
            firstName: user.firstName ?? 'Utilisateur',
            otp,
            expiry:    10,
        };
        await this.mailQueue.add(MailJobType.RESET_PASSWORD, job, {
            attempts:  3,
            backoff:   { type: 'exponential', delay: 5000 },
            removeOnComplete: 100,
            removeOnFail:     50,
        });
    }

    // ── Reset password (lien — web uniquement) ────────────────

    async sendResetPasswordLink(user: MailRecipient, resetUrl: string): Promise<void> {
        const job: ResetLinkJob = {
            type:      MailJobType.RESET_LINK,
            to:        user.email!,
            firstName: user.firstName ?? 'Utilisateur',
            resetUrl,
            expiry:    2, // heures
        };
        await this.mailQueue.add(MailJobType.RESET_LINK, job, {
            attempts:  3,
            backoff:   { type: 'exponential', delay: 5000 },
            removeOnComplete: 100,
            removeOnFail:     50,
        });
    }

    // ── Reset PIN (mobile) ────────────────────────────────────

    async sendResetPinCode(user: MailRecipient, otp: string): Promise<void> {
        const job: ResetPinJob = {
            type:      MailJobType.RESET_PIN,
            to:        user.email!,
            firstName: user.firstName ?? 'Utilisateur',
            otp,
            expiry:    10,
        };
        await this.mailQueue.add(MailJobType.RESET_PIN, job, {
            attempts:  3,
            backoff:   { type: 'exponential', delay: 5000 },
            removeOnComplete: 100,
            removeOnFail:     50,
        });
    }

    // ── Contact — notification admin ──────────────────────────

    async sendContactNotification(params: {
        adminEmail: string;
        senderName: string;
        senderEmail: string;
        subject?: string;
        message: string;
    }): Promise<void> {
        const job: ContactNotifyJob = {
            type:        MailJobType.CONTACT_NOTIFY,
            to:          params.adminEmail,
            firstName:   'Admin',
            senderName:  params.senderName,
            senderEmail: params.senderEmail,
            subject:     params.subject,
            message:     params.message,
        };
        await this.mailQueue.add(MailJobType.CONTACT_NOTIFY, job, {
            attempts:  3,
            backoff:   { type: 'exponential', delay: 5000 },
            removeOnComplete: 100,
            removeOnFail:     50,
        });
    }

    // ── Contact — accusé de réception ─────────────────────────

    async sendContactAcknowledgement(sender: MailRecipient, subject?: string): Promise<void> {
        const job: ContactAckJob = {
            type:      MailJobType.CONTACT_ACK,
            to:        sender.email!,
            firstName: sender.firstName ?? 'Utilisateur',
            subject,
        };
        await this.mailQueue.add(MailJobType.CONTACT_ACK, job, {
            attempts:  3,
            backoff:   { type: 'exponential', delay: 5000 },
            removeOnComplete: 100,
            removeOnFail:     50,
        });
    }
}
