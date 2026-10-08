// ============================================================
// UNIFIED AUTH — api-error.entity.ts
// Trace des erreurs 5xx (ApiErrorFilter) — pour les consulter sans accès
// serveur (pm2 logs), en complément du log — pas à sa place : le log garde
// tout (y compris < 500), cette table ne garde que ce qui vaut la peine
// d'être consultable (5xx), purgé automatiquement.
// ============================================================
import { Entity, Column, Index } from 'typeorm';
import { Audit } from '../../shared/audit';

@Entity('api_errors')
export class ApiErrorLog extends Audit {
  static entityName = 'api_errors';

  /** Même valeur que dans la réponse client et dans la ligne de log — clé de recherche. */
  @Index({ unique: true })
  @Column({ name: 'error_id', length: 16 })
  errorId!: string;

  @Column({ name: 'status_code' })
  statusCode!: number;

  @Column()
  method!: string;

  @Column()
  path!: string;

  @Column({ name: 'user_email', nullable: true })
  userEmail?: string;

  @Column({ nullable: true })
  ip?: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'text', nullable: true })
  stack?: string;
}
