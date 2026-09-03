// ============================================================
// AMISACHE — church.entity.ts
// Nœud unique de la hiérarchie ecclésiale, auto-référent :
// conférence → archidiocèse → diocèse → doyenné → paroisse →
// communauté → église/chapelle. Voir AMISACHE.md §1, §3 et
// cahier-des-charges-amisache.md §4.2–4.3.
//
// Règles métier (validées côté ChurchService, pas en contrainte de
// schéma) :
//   - le type du parent doit être à un niveau strictement supérieur
//     (les niveaux manquants sont nativement gérés par l'auto-référence) ;
//   - CHURCH/CHAPEL sont des feuilles rattachées à PAROISSE ou
//     COMMUNAUTE (souplesse assumée) ;
//   - `perimeter` (4 à 20 sommets, ring fermé) est une validation DTO,
//     pas une contrainte MySQL.
// ============================================================
import {
  Entity,
  Column,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
  BeforeInsert,
} from 'typeorm';
import { Audit } from '../../shared/audit';
import { Address } from '../../address/entities/address.embeddable';
import { Country } from '../../address/entities/country.entity';
import { EntityType, ValidationStatus } from '../church.enum';
import type { Polygon } from '../../shared/geo';

@Entity('churches')
export class Church extends Audit {
  static entityName = 'churches';
  static entityCode = '25';

  @Column({ type: 'enum', enum: EntityType })
  type!: EntityType;

  @Column()
  name!: string;

  /** Lien partageable de la page — unique, généré depuis `name` si absent */
  @Index({ unique: true })
  @Column()
  slug!: string;

  @Column({ type: 'text', nullable: true, name: 'leader_message' })
  leaderMessage?: string;

  @Column({ nullable: true, name: 'banner_photo' })
  bannerPhoto?: string;

  /** Couleur d'accent propre à l'entité — voir CLAUDE.md « unir sans uniformiser » */
  @Column({ nullable: true, length: 7, name: 'accent_color' })
  accentColor?: string;

  @Column({ nullable: true, length: 10, default: 'fr', name: 'default_language' })
  defaultLanguage?: string;

  @Column({ type: 'enum', enum: ValidationStatus, default: ValidationStatus.PENDING })
  status!: ValidationStatus;

  /**
   * Emprise géographique (paroisse notamment). 4 à 20 sommets, ring
   * MySQL fermé — validé par ChurchService.setPerimeter, jamais par le
   * schéma. Absent tant qu'aucune emprise n'a été définie.
   */
  @Column({
    type: 'polygon',
    nullable: true,
    spatialFeatureType: 'Polygon',
    srid: 4326,
  })
  perimeter?: Polygon;

  // ─── Auto-référence : hiérarchie ecclésiale ─────────────────
  // ⚠️ parentId est en LECTURE SEULE — modifier via parent: { id } as any
  // onDelete RESTRICT : une entité avec des enfants ne peut pas être
  // supprimée tant qu'ils n'ont pas été déplacés/supprimés explicitement.

  @Index()
  @Column({ nullable: true, name: 'parent_id' })
  parentId?: string;

  @ManyToOne(() => Church, (church) => church.children, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'parent_id', referencedColumnName: 'id' })
  parent?: Church;

  @OneToMany(() => Church, (church) => church.parent)
  children?: Church[];

  // ─── Relation : Country (niveau CONFERENCE uniquement) ──────
  // ⚠️ countryId est en LECTURE SEULE — modifier via country: { id } as any

  @Column({ nullable: true, name: 'country_id' })
  countryId?: string;

  @ManyToOne(() => Country, { nullable: true, eager: false })
  @JoinColumn({ name: 'country_id', referencedColumnName: 'id' })
  country?: Country;

  // ─── Adresse (objet-valeur embarqué) ────────────────────────

  @Column(() => Address, { prefix: false })
  address!: Address;

  /** Code lisible généré à l'insertion (ex: 25-1717000000000) */
  @Column()
  code?: string;

  @BeforeInsert()
  prepare() {
    this.name = this.name?.trim();
    this.code = Church.entityCode + Date.now();
  }
}
