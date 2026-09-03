// ============================================================
// AMISACHE — schedule.entity.ts
// Horaire liturgique récurrent (messe, confession, adoration...).
// Voir cahier-des-charges §4.5.
// ============================================================
import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
} from 'typeorm';
import { Audit } from '../../shared/audit';
import { Church } from '../../church/entities/church.entity';
import { Type } from '../../type/entities/type.entity';
import { ScheduleFrequency, LiturgicalSeason } from '../liturgy.enum';

@Entity('schedules')
export class Schedule extends Audit {
  static entityName = 'schedules';
  static entityCode = '31';

  @Column({ type: 'enum', enum: ScheduleFrequency })
  frequency!: ScheduleFrequency;

  /** 0 (dimanche) à 6 (samedi) — requis pour WEEKLY/BIWEEKLY/MONTHLY */
  @Column({ type: 'tinyint', nullable: true, name: 'day_of_week' })
  dayOfWeek?: number;

  /** 1 à 5 (ex: 2 = « 2ᵉ dimanche du mois ») — requis pour MONTHLY uniquement */
  @Column({ type: 'tinyint', nullable: true, name: 'week_of_month' })
  weekOfMonth?: number;

  @Column({ type: 'time' })
  time!: string;

  /** Durée en minutes — détecte une messe « en cours » (§4.11) */
  @Column({ type: 'int' })
  duration!: number;

  @Column({ nullable: true, length: 10 })
  language?: string;

  @Column({ type: 'enum', enum: LiturgicalSeason, default: LiturgicalSeason.ORDINARY })
  season!: LiturgicalSeason;

  /** ONCE : LA date de l'occurrence. Autres fréquences : début de validité (horaires temporaires) */
  @Column({ type: 'date', nullable: true, name: 'start_date' })
  startDate?: string;

  @Column({ type: 'date', nullable: true, name: 'end_date' })
  endDate?: string;

  // ─── Relation : Church ──────────────────────────────────────
  // ⚠️ churchId est en LECTURE SEULE — modifier via church: { id } as any

  @Index()
  @Column({ name: 'church_id' })
  churchId!: string;

  @ManyToOne(() => Church, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'church_id', referencedColumnName: 'id' })
  church?: Church;

  // ─── Relation : Type (scope=SCHEDULE) ───────────────────────
  // ⚠️ typeId est en LECTURE SEULE — modifier via type: { id } as any

  @Index()
  @Column({ name: 'type_id' })
  typeId!: string;

  @ManyToOne(() => Type, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'type_id', referencedColumnName: 'id' })
  type?: Type;

  /** Code lisible généré à l'insertion (ex: 31-1717000000000) */
  @Column()
  code?: string;

  @BeforeInsert()
  prepare() {
    this.code = Schedule.entityCode + Date.now();
  }
}
