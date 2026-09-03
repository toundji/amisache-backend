// ============================================================
// AMISACHE — publication.entity.ts
// Unité de contenu du fil d'une église : annonce, événement, vidéo,
// album... (genre porté par Type, scope=PUBLICATION). Voir
// cahier-des-charges §4.8.
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
import { Group } from './group.entity';
import { PublicationStatus } from '../community.enum';

@Entity('publications')
export class Publication extends Audit {
  static entityName = 'publications';
  static entityCode = '34';

  @Column()
  title!: string;

  @Column({ type: 'text' })
  content!: string;

  /** Renseigné automatiquement au premier passage en PUBLISHED */
  @Column({ type: 'datetime', nullable: true, name: 'published_at' })
  publishedAt?: Date;

  @Column({ type: 'enum', enum: PublicationStatus, default: PublicationStatus.DRAFT })
  status!: PublicationStatus;

  /** Fenêtre d'affichage temporaire (événement) — absente = affichage permanent */
  @Column({ type: 'date', nullable: true, name: 'start_date' })
  startDate?: string;

  @Column({ type: 'date', nullable: true, name: 'end_date' })
  endDate?: string;

  // ─── Relation : Church (auteur, toujours) ───────────────────
  // ⚠️ churchId est en LECTURE SEULE — modifier via church: { id } as any

  @Index()
  @Column({ name: 'church_id' })
  churchId!: string;

  @ManyToOne(() => Church, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'church_id', referencedColumnName: 'id' })
  church?: Church;

  // ─── Relation : Group (auteur secondaire, optionnel) ────────
  // Une chorale peut publier sur sa page comme sur le fil de l'église.
  // ⚠️ groupId est en LECTURE SEULE — modifier via group: { id } as any

  @Column({ nullable: true, name: 'group_id' })
  groupId?: string;

  @ManyToOne(() => Group, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'group_id', referencedColumnName: 'id' })
  group?: Group;

  // ─── Relation : Type (scope=PUBLICATION) ────────────────────
  // ⚠️ typeId est en LECTURE SEULE — modifier via type: { id } as any

  @Index()
  @Column({ name: 'type_id' })
  typeId!: string;

  @ManyToOne(() => Type, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'type_id', referencedColumnName: 'id' })
  type?: Type;

  /** Code lisible généré à l'insertion (ex: 34-1717000000000) */
  @Column()
  code?: string;

  @BeforeInsert()
  prepare() {
    this.title = this.title?.trim();
    this.code = Publication.entityCode + Date.now();
  }
}
