// ============================================================
// AMISACHE — payment-method.entity.ts
// Coordonnées d'encaissement Mobile Money publiées par une église —
// voir cahier-des-charges §4.7 (flux déclaratif).
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
import { PaymentOperator } from '../payment.enum';

@Entity('payment_methods')
export class PaymentMethod extends Audit {
  static entityName = 'payment_methods';
  static entityCode = '29';

  @Column({ type: 'enum', enum: PaymentOperator })
  operator!: PaymentOperator;

  @Column()
  phone!: string;

  @Column({ name: 'account_name' })
  accountName!: string;

  /** Désactivée = ne doit plus apparaître dans les sélecteurs de paiement */
  @Column({ default: true })
  active!: boolean;

  // ─── Relation : Church ──────────────────────────────────────
  // ⚠️ churchId est en LECTURE SEULE — modifier via church: { id } as any

  @Index()
  @Column({ name: 'church_id' })
  churchId!: string;

  @ManyToOne(() => Church, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'church_id', referencedColumnName: 'id' })
  church?: Church;

  /** Code lisible généré à l'insertion (ex: 29-1717000000000) */
  @Column()
  code?: string;

  @BeforeInsert()
  prepare() {
    this.phone = this.phone?.trim();
    this.accountName = this.accountName?.trim();
    this.code = PaymentMethod.entityCode + Date.now();
  }
}
