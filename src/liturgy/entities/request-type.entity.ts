// ============================================================
// AMISACHE — request-type.entity.ts
// Table dédiée aux types de demande (intention de messe / sacrement) —
// sortie de la table mutualisée `types` (2026-09-26) : ces types sont
// référencés par Request et Tariff, jamais par Donation/Publication/Schedule
// (restés dans `type/`) — les séparer évite qu'un changement lié aux
// demandes touche à un référentiel partagé par le reste de la plateforme.
// ============================================================
import { Entity, Column, Index, BeforeInsert } from 'typeorm';
import { Audit } from '../../shared/audit';
import { RequestTypeScope } from '../request-type.enum';

@Entity('request_types')
@Index(['scope', 'name'], { unique: true })
export class RequestType extends Audit {
  static entityName = 'request_types';
  static entityCode = '41';

  @Column()
  name!: string;

  @Column({ type: 'enum', enum: RequestTypeScope })
  scope!: RequestTypeScope;

  /** Un type désactivé reste référencé par l'historique mais disparaît des listes actives */
  @Column({ default: true })
  active!: boolean;

  /** Peut-il être demandé en célébration à domicile plutôt qu'à l'église ? */
  @Column({ default: false, name: 'allow_home_celebration' })
  allowHomeCelebration!: boolean;

  /** Délai minimum, en jours, entre l'envoi d'une demande et la date souhaitée. */
  @Column({ type: 'int', default: 2, name: 'min_lead_days' })
  minLeadDays!: number;

  /** La date souhaitée doit-elle correspondre à une messe déjà programmée (Schedule) ? */
  @Column({ default: false, name: 'requires_schedule_match' })
  requiresScheduleMatch!: boolean;

  /** Code lisible généré à l'insertion (ex: 41-1717000000000) */
  @Column()
  code?: string;

  @BeforeInsert()
  prepare() {
    this.name = this.name?.trim();
    this.code = RequestType.entityCode + Date.now();
  }
}
