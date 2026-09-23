// ============================================================
// AMISACHE — request.entity.ts
// Demande UNIFIÉE : intention de messe et sacrement, discriminées par
// le scope du Type lié (INTENTION / SACRAMENT). Voir cahier-des-charges
// §4.6.
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
import { User } from '../../users/entities/user.entity';
import { Schedule } from './schedule.entity';
import { Type } from '../../type/entities/type.entity';
import { Payment } from '../../payment/entities/payment.entity';
import { RequestStatus } from '../liturgy.enum';
import { pointTransformer } from '../../shared/geo';
import type { Point } from '../../shared/geo';

@Entity('requests')
export class Request extends Audit {
  static entityName = 'requests';
  static entityCode = '32';

  /** Doit être une occurrence valide de `schedule` si renseigné (§4.6, voir liturgy.util.ts) */
  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'text', nullable: true })
  text?: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  offering?: string;

  /** URL(s) de pièces jointes — libre, encodage à la charge du client */
  @Column({ type: 'text', nullable: true })
  attachments?: string;

  // ─── Célébration à domicile (optionnelle) ───────────────────
  // N'importe quelle intention/sacrement peut être demandé à domicile plutôt
  // qu'à l'église — pas un Type à part : une simple adresse jointe à la
  // demande, quel que soit le motif choisi.

  /** Adresse libre du domicile — repère local, pas un objet Address complet
   *  (pas de Zone obligatoire à faire choisir pour une demande ponctuelle). */
  @Column({ type: 'text', nullable: true, name: 'home_address' })
  homeAddress?: string;

  /** Position GPS optionnelle du domicile (capture navigateur, best-effort) */
  @Column({
    type: 'point',
    nullable: true,
    spatialFeatureType: 'Point',
    srid: 4326,
    transformer: pointTransformer,
    name: 'home_location',
  })
  homeLocation?: Point;

  @Column({ type: 'enum', enum: RequestStatus, default: RequestStatus.SUBMITTED })
  status!: RequestStatus;

  // ─── Relation : Church (destinataire de la demande) ─────────
  // ⚠️ churchId est en LECTURE SEULE — modifier via church: { id } as any

  @Index()
  @Column({ name: 'church_id' })
  churchId!: string;

  @ManyToOne(() => Church, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'church_id', referencedColumnName: 'id' })
  church?: Church;

  // ─── Relation : User (demandeur) ─────────────────────────────
  // ⚠️ userId est en LECTURE SEULE — modifier via user: { id } as any

  @Index()
  @Column({ name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', referencedColumnName: 'id' })
  user?: User;

  // ─── Relation : Schedule (quelle messe, optionnel) ──────────
  // ⚠️ scheduleId est en LECTURE SEULE — modifier via schedule: { id } as any

  @Column({ nullable: true, name: 'schedule_id' })
  scheduleId?: string;

  @ManyToOne(() => Schedule, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'schedule_id', referencedColumnName: 'id' })
  schedule?: Schedule;

  // ─── Relation : Type (scope=INTENTION ou SACRAMENT) ─────────
  // ⚠️ typeId est en LECTURE SEULE — modifier via type: { id } as any

  @Index()
  @Column({ name: 'type_id' })
  typeId!: string;

  @ManyToOne(() => Type, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'type_id', referencedColumnName: 'id' })
  type?: Type;

  // ─── Relation : Payment (offrande, optionnelle) ─────────────
  // ⚠️ paymentId est en LECTURE SEULE — modifier via payment: { id } as any

  @Column({ nullable: true, name: 'payment_id' })
  paymentId?: string;

  @ManyToOne(() => Payment, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'payment_id', referencedColumnName: 'id' })
  payment?: Payment;

  /** Code lisible généré à l'insertion (ex: 32-1717000000000) */
  @Column()
  code?: string;

  @BeforeInsert()
  prepare() {
    this.code = Request.entityCode + Date.now();
  }
}
