// ============================================================
// UNIFIED AUTH — faq.entity.ts
// Question fréquente affichée publiquement, gérée par l'admin.
// ============================================================
import { Entity, Column } from 'typeorm';
import { Audit } from '../../shared/audit';
import { FaqCategory } from '../../shared/common.enum';

@Entity('faqs')
export class Faq extends Audit {
  static entityName = 'faqs';

  @Column({ type: 'text' })
  question!: string;

  /** Vide tant que la FAQ est en brouillon (pas encore répondue) */
  @Column({ type: 'text', nullable: true })
  answer?: string;

  @Column({ type: 'enum', enum: FaqCategory, nullable: true })
  category?: FaqCategory;

  /** Ordre d'affichage croissant — les FAQ publiques sont triées dessus */
  @Column({ default: 0, name: 'sort_order' })
  sortOrder!: number;

  /** Renseigné automatiquement dès que `answer` est non vide — null = brouillon, invisible sur la route publique */
  @Column({ type: 'datetime', nullable: true, name: 'answered_at' })
  answeredAt?: Date;

  /** Renseigné manuellement pour masquer une FAQ même répondue */
  @Column({ type: 'datetime', nullable: true, name: 'hidden_at' })
  hiddenAt?: Date;
}
