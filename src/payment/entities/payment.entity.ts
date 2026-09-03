// ============================================================
// AMISACHE — payment.entity.ts
// Paiement déclaratif — mutualisé entre Request et Donation (elles le
// référencent par paymentId, jamais l'inverse). Voir cahier-des-charges
// §4.7 et AMISACHE.md §7.6 (règle dure : confirmedBy = ClergyMember de
// LA paroisse concernée, jamais un User quelconque).
//
// ⚠️ Payment ne porte NI churchId NI userId directement (fidèle au
// diagramme) : la paroisse se déduit de `paymentMethod.churchId`, et le
// payeur de l'entité hôte (Request.userId / Donation.userId).
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
import { PaymentMethod } from './payment-method.entity';
import { ClergyMember } from '../../church/entities/clergy-member.entity';
import { PaymentOperator, PaymentStatus } from '../payment.enum';

@Entity('payments')
export class Payment extends Audit {
  static entityName = 'payments';
  static entityCode = '30';

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: string;

  @Column({ type: 'enum', enum: PaymentOperator })
  operator!: PaymentOperator;

  /** Référence de la transaction Mobile Money, fournie par le fidèle */
  @Column()
  reference!: string;

  @Column({ name: 'receipt_image' })
  receiptImage!: string;

  @Column({ type: 'date', name: 'paid_at' })
  paidAt!: string;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.SUBMITTED })
  status!: PaymentStatus;

  @Column({ type: 'datetime', nullable: true, name: 'confirmed_at' })
  confirmedAt?: Date;

  // ─── Relation : PaymentMethod ───────────────────────────────
  // ⚠️ paymentMethodId est en LECTURE SEULE — modifier via paymentMethod: { id } as any

  @Index()
  @Column({ name: 'payment_method_id' })
  paymentMethodId!: string;

  @ManyToOne(() => PaymentMethod, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'payment_method_id', referencedColumnName: 'id' })
  paymentMethod?: PaymentMethod;

  // ─── Relation : ClergyMember (confirmation) ─────────────────
  // ⚠️ confirmedById est en LECTURE SEULE — modifier via confirmedBy: { id } as any
  // ⚠️ RÈGLE DURE (§7.6) : posé UNIQUEMENT par PaymentService.confirm, après
  // vérification que ce ClergyMember appartient à paymentMethod.churchId.
  // Ne jamais assigner ce champ ailleurs.

  @Column({ nullable: true, name: 'confirmed_by_id' })
  confirmedById?: string;

  @ManyToOne(() => ClergyMember, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'confirmed_by_id', referencedColumnName: 'id' })
  confirmedBy?: ClergyMember;

  /** Code lisible généré à l'insertion (ex: 30-1717000000000) */
  @Column()
  code?: string;

  @BeforeInsert()
  prepare() {
    this.reference = this.reference?.trim();
    this.code = Payment.entityCode + Date.now();
  }
}
