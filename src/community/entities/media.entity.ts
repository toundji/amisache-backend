// ============================================================
// AMISACHE — media.entity.ts
// Média (0..*) rattaché à une publication — vidéos YouTube de messe,
// vidéos de chants, albums photos. Voir cahier-des-charges §4.8.
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
import { Publication } from './publication.entity';
import { MediaKind, MediaProvider } from '../community.enum';

@Entity('media')
export class Media extends Audit {
  static entityName = 'media';
  static entityCode = '35';

  @Column({ type: 'enum', enum: MediaKind })
  kind!: MediaKind;

  @Column({ type: 'enum', enum: MediaProvider })
  provider!: MediaProvider;

  @Column()
  url!: string;

  // ─── Relation : Publication ──────────────────────────────────
  // ⚠️ publicationId est en LECTURE SEULE — modifier via publication: { id } as any

  @Index()
  @Column({ name: 'publication_id' })
  publicationId!: string;

  @ManyToOne(() => Publication, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'publication_id', referencedColumnName: 'id' })
  publication?: Publication;

  /** Code lisible généré à l'insertion (ex: 35-1717000000000) */
  @Column()
  code?: string;

  @BeforeInsert()
  prepare() {
    this.code = Media.entityCode + Date.now();
  }
}
