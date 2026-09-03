// ============================================================
// UNIFIED AUTH — mail-failed.service.ts
// Gestion des emails échoués — sauvegarde, liste, relance.
// ============================================================
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';

import { MAIL_QUEUE, MailJob, MailJobType } from './mail.types';
import { ApiError, ApiErrorNotFoundById } from '../utils/api-error';
import { HttpStatus } from '@nestjs/common';
import { MailFailedJob, MailFailedStatus } from './entities/mail-failed.entity';

@Injectable()
export class MailFailedService {

    private readonly logger = new Logger(MailFailedService.name);

    constructor(
        @InjectRepository(MailFailedJob)
        private readonly repo: Repository<MailFailedJob>,
        @InjectQueue(MAIL_QUEUE)
        private readonly mailQueue: Queue,
    ) { }

    // ── Sauvegarde à l'échec initial ─────────────────────────

    /**
     * Appelé par MailProcessor.onJobFailed quand toutes les tentatives
     * sont épuisées et que le job n'est PAS une relance manuelle.
     */
    async saveFailedJob(job: Job<MailJob>, error: Error): Promise<void> {
        try {
            await this.repo.save({
                type: job.data.type,
                to: job.data.to,
                payload: job.data as unknown as Record<string, unknown>,
                lastError: error.message,
                attempts: job.attemptsMade,
                status: MailFailedStatus.pending,
            });
            this.logger.warn(
                `[MailFailed] Job "${job.data.type}" → "${job.data.to}" saved after ${job.attemptsMade} attempts. Error: ${error.message}`,
            );
        } catch (saveErr) {
            this.logger.error(`[MailFailed] Could not save failed job: ${saveErr}`);
        }
    }

    /**
     * Appelé par MailProcessor.onJobFailed quand le job est une relance manuelle
     * (_retriedFromId présent). Met à jour l'entrée existante sans en créer une nouvelle.
     */
    async updateFailedJob(retriedFromId: string, error: Error, attempts: number): Promise<void> {
        try {
            await this.repo.update(retriedFromId, {
                status: MailFailedStatus.pending,
                lastError: error.message,
                attempts,
            });
            this.logger.warn(
                `[MailFailed] Retry of job "${retriedFromId}" also failed. Error: ${error.message}`,
            );
        } catch (updateErr) {
            this.logger.error(`[MailFailed] Could not update failed job: ${updateErr}`);
        }
    }

    // ── Liste ─────────────────────────────────────────────────

    async list(status?: MailFailedStatus): Promise<MailFailedJob[]> {
        return this.repo.find({
            where: status ? { status } : undefined,
            order: { createdAt: 'DESC' },
        });
    }

    // ── Relance ───────────────────────────────────────────────

    /**
     * Remet le job dans la queue BullMQ avec _retriedFromId pour traçabilité.
     * Si ce nouveau job échoue aussi, onJobFailed mettra à jour l'entrée
     * existante au lieu d'en créer une nouvelle.
     */
    async retry(id: string): Promise<{ success: boolean }> {
        const failed = await this.repo.findOne({ where: { id } });
        if (!failed) throw new ApiErrorNotFoundById('mail_failed_jobs', id);

        if (failed.status !== MailFailedStatus.pending) {
            throw new ApiError(
                `This job is already "${failed.status}" and cannot be retried.`,
                { code: HttpStatus.CONFLICT },
            );
        }

        // Injecter _retriedFromId dans le payload pour que onJobFailed
        // sache qu'il s'agit d'une relance et mette à jour l'entrée existante
        const payload = {
            ...(failed.payload as unknown as MailJob),
            _retriedFromId: id,
        };

        await this.mailQueue.add(failed.type, payload, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: 100,
            removeOnFail: 50,
        });

        // Ne pas marquer comme retried ici — le processor confirmera
        // via onJobCompleted et supprimera l'entrée si succès
        this.logger.log(`[MailFailed] Job "${failed.type}" → "${failed.to}" requeued.`);
        return { success: true };
    }

    /**
     * Appelé par MailProcessor.onJobCompleted quand la relance réussit.
     * Supprime définitivement l'entrée — pas d'historique inutile en DB.
     */
    async deleteOnSuccess(retriedFromId: string): Promise<void> {
        try {
            await this.repo.delete(retriedFromId);
            this.logger.log(`[MailFailed] Job "${retriedFromId}" succeeded — entry deleted.`);
        } catch (err) {
            this.logger.error(`[MailFailed] Could not delete succeeded job: ${err}`);
        }
    }

    // ── Abandon ───────────────────────────────────────────────

    async abandon(id: string): Promise<{ success: boolean }> {
        const failed = await this.repo.findOne({ where: { id } });
        if (!failed) throw new ApiErrorNotFoundById('mail_failed_jobs', id);

        await this.repo.update(id, { status: MailFailedStatus.abandoned });
        return { success: true };
    }
}