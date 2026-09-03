// ============================================================
// AMISACHE — donation.entity.ts
// Don du fidèle — geste spontané, distinct de Request (qui porte une
// demande). Voir cahier-des-charges §4.7. Paiement TOUJOURS requis
// (cardinalité "1", contrairement à Request où il est optionnel).
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
import { Type } from '../../type/entities/type.entity';
import { Payment } from '../../payment/entities/payment.entity';

@Entity('donations')
export class Donation extends Audit {
  static entityName = 'donations';
  static entityCode = '33';

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: string;

  @Column({ type: 'datetime' })
  date!: Date;

  // ─── Relation : Church (bénéficiaire) ───────────────────────
  // ⚠️ churchId est en LECTURE SEULE — modifier via church: { id } as any

  @Index()
  @Column({ name: 'church_id' })
  churchId!: string;

  @ManyToOne(() => Church, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'church_id', referencedColumnName: 'id' })
  church?: Church;

  // ─── Relation : User (donateur) ──────────────────────────────
  // ⚠️ userId est en LECTURE SEULE — modifier via user: { id } as any

  @Index()
  @Column({ name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', referencedColumnName: 'id' })
  user?: User;

  // ─── Relation : Type (scope=DONATION) ───────────────────────
  // ⚠️ typeId est en LECTURE SEULE — modifier via type: { id } as any

  @Index()
  @Column({ name: 'type_id' })
  typeId!: string;

  @ManyToOne(() => Type, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'type_id', referencedColumnName: 'id' })
  type?: Type;

  // ─── Relation : Payment (requis) ─────────────────────────────
  // ⚠️ paymentId est en LECTURE SEULE — modifier via payment: { id } as any

  @Column({ name: 'payment_id' })
  paymentId!: string;

  @ManyToOne(() => Payment, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'payment_id', referencedColumnName: 'id' })
  payment?: Payment;

  /** Code lisible généré à l'insertion (ex: 33-1717000000000) */
  @Column()
  code?: string;

  @BeforeInsert()
  prepare() {
    this.code = Donation.entityCode + Date.now();
  }
}
