// ============================================================
// UNIFIED AUTH — mail-failed.entity.ts
// Stocke les emails qui ont échoué après toutes les tentatives BullMQ.
// Permet de les inspecter et relancer manuellement via /mail/failed.
// ============================================================
import { Audit } from 'src/shared/audit';
import { Entity, Column } from 'typeorm';
import { MailJobType } from '../mail.types';

export enum MailFailedStatus {
    pending = 'pending',    // échoué, pas encore relancé
    abandoned = 'abandoned',  // abandonné manuellement par un admin
}

@Entity('mail_failed_jobs')
export class MailFailedJob extends Audit {

    @Column({ type: 'enum', enum: MailJobType })
    type!: MailJobType;

    @Column()
    to!: string;

    @Column({ type: 'json' })
    payload!: Record<string, unknown>;

    @Column({ type: 'text', nullable: true, name: 'last_error' })
    lastError?: string;

    @Column({ default: 0 })
    attempts!: number;

    @Column({
        type: 'enum',
        enum: MailFailedStatus,
        default: MailFailedStatus.pending,
    })
    status!: MailFailedStatus;
}