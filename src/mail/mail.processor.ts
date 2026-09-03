// ============================================================
// UNIFIED AUTH — mail.processor.ts
// Worker BullMQ — consomme la queue et envoie les emails.
// S'exécute en arrière-plan, indépendamment des requêtes HTTP.
//
// Retry automatique : 3 tentatives avec backoff exponentiel
// (5s, 25s, 125s) en cas d'échec SMTP.
// ============================================================
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { MailerService } from '@nestjs-modules/mailer';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';

import { MAIL_QUEUE, MailJob, MailJobType } from './mail.types';
import { MailFailedService } from './mail-failed.service';

@Processor(MAIL_QUEUE)
export class MailProcessor extends WorkerHost {

    private readonly logger = new Logger(MailProcessor.name);

    constructor(
        private readonly mailerService: MailerService,
        private readonly mailFailedService: MailFailedService,
    ) {
        super();
    }

    /**
     * Point d'entrée unique — BullMQ appelle cette méthode pour chaque job.
     * On dispatch selon le type du job.
     */
    async process(job: Job<MailJob>): Promise<void> {
        switch (job.data.type) {
            case MailJobType.CONFIRM_EMAIL:
                return this.handleConfirmEmail(job);
            case MailJobType.RESET_PASSWORD:
                return this.handleResetPassword(job);
            case MailJobType.RESET_PIN:
                return this.handleResetPin(job);
            case MailJobType.RESET_LINK:
                return this.handleResetLink(job);
            case MailJobType.CONTACT_NOTIFY:
                return this.handleContactNotify(job);
            case MailJobType.CONTACT_ACK:
                return this.handleContactAck(job);
            default:
                this.logger.warn(`Unknown job type: ${(job.data as any).type}`);
        }
    }

    /**
     * Appelé par BullMQ quand toutes les tentatives sont épuisées.
     *
     * Deux cas :
     * 1. Job initial → sauvegarder une nouvelle entrée en DB
     * 2. Relance manuelle (_retriedFromId présent) → mettre à jour l'entrée existante
     *    sans créer de doublon.
     */
    @OnWorkerEvent('failed')
    async onJobFailed(job: Job<MailJob>, error: Error): Promise<void> {
        if (job.attemptsMade < (job.opts.attempts ?? 3)) return;

        const retriedFromId = job.data._retriedFromId;

        if (retriedFromId) {
            await this.mailFailedService.updateFailedJob(retriedFromId, error, job.attemptsMade);
        } else {
            await this.mailFailedService.saveFailedJob(job, error);
        }
    }

    /**
     * Appelé par BullMQ quand un job réussit.
     * Si c'est une relance manuelle, supprime l'entrée DB — pas d'historique inutile.
     */
    @OnWorkerEvent('completed')
    async onJobCompleted(job: Job<MailJob>): Promise<void> {
        const retriedFromId = job.data._retriedFromId;
        if (retriedFromId) {
            await this.mailFailedService.deleteOnSuccess(retriedFromId);
        }
    }

    // ── Handlers ──────────────────────────────────────────────

    private async handleConfirmEmail(job: Job<MailJob>): Promise<void> {
        const data = job.data as Extract<MailJob, { type: MailJobType.CONFIRM_EMAIL }>;

        await this.mailerService.sendMail({
            to: data.to,
            subject: 'Confirmez votre adresse email',
            template: 'confirm-email',
            context: {
                appName: process.env.APP_NAME ?? 'App',
                appTagline: process.env.APP_TAGLINE ?? '',
                year: new Date().getFullYear(),
                firstName: data.firstName,
                otp: data.otp,
                expiry: data.expiry,
            },
        });

        this.logger.log(`Confirmation sent to ${data.to}`);
    }

    private async handleResetPassword(job: Job<MailJob>): Promise<void> {
        const data = job.data as Extract<MailJob, { type: MailJobType.RESET_PASSWORD }>;

        await this.mailerService.sendMail({
            to: data.to,
            subject: 'Réinitialisation de votre mot de passe',
            template: 'reset-password',
            context: {
                appName: process.env.APP_NAME ?? 'App',
                appTagline: process.env.APP_TAGLINE ?? '',
                year: new Date().getFullYear(),
                firstName: data.firstName,
                otp: data.otp,
                expiry: data.expiry,
            },
        });

        this.logger.log(`Reset password sent to ${data.to}`);
    }

    private async handleResetPin(job: Job<MailJob>): Promise<void> {
        const data = job.data as Extract<MailJob, { type: MailJobType.RESET_PIN }>;

        await this.mailerService.sendMail({
            to: data.to,
            subject: 'Réinitialisation de votre code PIN',
            template: 'reset-pin',
            context: {
                appName: process.env.APP_NAME ?? 'App',
                appTagline: process.env.APP_TAGLINE ?? '',
                year: new Date().getFullYear(),
                firstName: data.firstName,
                otp: data.otp,
                expiry: data.expiry,
            },
        });

        this.logger.log(`Reset PIN sent to ${data.to}`);
    }

    private async handleResetLink(job: Job<MailJob>): Promise<void> {
        const data = job.data as Extract<MailJob, { type: MailJobType.RESET_LINK }>;

        await this.mailerService.sendMail({
            to: data.to,
            subject: 'Réinitialisation de votre mot de passe',
            template: 'reset-link',
            context: {
                appName: process.env.APP_NAME ?? 'App',
                appTagline: process.env.APP_TAGLINE ?? '',
                year: new Date().getFullYear(),
                firstName: data.firstName,
                resetUrl: data.resetUrl,
                expiry: data.expiry,
            },
        });

        this.logger.log(`Reset link sent to ${data.to}`);
    }

    private async handleContactNotify(job: Job<MailJob>): Promise<void> {
        const data = job.data as Extract<MailJob, { type: MailJobType.CONTACT_NOTIFY }>;

        await this.mailerService.sendMail({
            to: data.to,
            subject: `[Contact] ${data.subject ?? 'Nouveau message'}`,
            template: 'contact-notify',
            context: {
                appName: process.env.APP_NAME ?? 'App',
                appTagline: process.env.APP_TAGLINE ?? '',
                year: new Date().getFullYear(),
                senderName: data.senderName,
                senderEmail: data.senderEmail,
                subject: data.subject,
                message: data.message,
            },
        });

        this.logger.log(`Contact notification sent to ${data.to}`);
    }

    private async handleContactAck(job: Job<MailJob>): Promise<void> {
        const data = job.data as Extract<MailJob, { type: MailJobType.CONTACT_ACK }>;

        await this.mailerService.sendMail({
            to: data.to,
            subject: 'Nous avons bien reçu votre message',
            template: 'contact-ack',
            context: {
                appName: process.env.APP_NAME ?? 'App',
                appTagline: process.env.APP_TAGLINE ?? '',
                year: new Date().getFullYear(),
                firstName: data.firstName,
                subject: data.subject,
            },
        });

        this.logger.log(`Contact acknowledgement sent to ${data.to}`);
    }
}