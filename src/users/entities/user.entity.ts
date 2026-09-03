// ============================================================
// UNIFIED AUTH — user.entity.ts
// Entité de base universelle.
// Chaque projet étend cette entité avec ses propres champs.
// ============================================================
import {
  Entity,
  Column,
  BeforeInsert,
  ManyToOne,
  JoinColumn,
  RelationId,
} from 'typeorm';
import { Exclude, Expose } from 'class-transformer';
import { Audit } from '../../shared/audit';
import { UserStatus, UserRole } from '../../shared/common.enum';
// ⚠️ Country (module address/) est aussi fondamental que shared/ — pas de
// logique métier propre — d'où cette exception ponctuelle à la règle de
// dépendance socle→métier. Voir AMISACHE.md §5 « Réconciliation de User ».
// Church, à l'inverse, NE DOIT JAMAIS être importé ici (§7.2) : homeChurchId
// reste un scalaire uuid nu, sans relation.
import { Country } from '../../address/entities/country.entity';

@Entity('users')
export class User extends Audit {
  static entityName = 'users';
  static entityCode = '01';

  // ── Identité ─────────────────────────────────────────────

  @Column({ nullable: true, name: 'first_name' })
  firstName?: string;

  @Column({ nullable: true, name: 'last_name' })
  lastName?: string;

  @Column({ nullable: true, unique: true })
  email?: string;

  @Column({ nullable: true, name: 'image_profile' })
  profile?: string;

  /** Indispensable au Bénin — lié au flux de paiement Mobile Money (AMISACHE.md §5) */
  @Column({ nullable: true })
  phone?: string;

  // ── Sécurité ─────────────────────────────────────────────

  /**
   * Mot de passe haché bcrypt (rounds=12).
   * select: false → jamais retourné dans les requêtes
   */
  @Exclude()
  @Column({ nullable: true, select: false })
  password?: string;

  /**
   * Google UID — renseigné lors d'une connexion via Google Firebase Auth.
   * Null pour les comptes classiques email/password.
   * select: false → jamais retourné dans les requêtes
   */
  @Exclude()
  @Column({ nullable: true, unique: true, name: 'google_id', select: false })
  googleId?: string;

  /**
   * PIN haché Argon2id (mobile). select: false → jamais retourné dans les requêtes.
   * Voir PasswordService pour le hashing/vérification.
   */
  @Exclude()
  @Column({ nullable: true, name: 'pin_code', type: 'text', select: false })
  pinCode?: string | null;

  @Column({ default: UserStatus.unverified, enum: UserStatus, type: 'enum' })
  status?: UserStatus;

  @Column({ type: 'set', enum: UserRole, default: [UserRole.user] })
  roles?: UserRole[];

  /**
   * Code unique généré à l'insertion.
   * Utilisé comme référence lisible (ex: 01-1717000000000)
   */
  @Exclude()
  @Column()
  code?: string;

  // ── Relations ─────────────────────────────────────────────

  /**
   * Relation country optionnelle.
   * Chaque projet injecte son entité Country.
   * On garde juste l'id ici pour la base universelle.
   */
  @Column({ nullable: true, name: 'id_country' })
  idCountry?: string;

  @ManyToOne(() => Country, { nullable: true, eager: false })
  @JoinColumn({ name: 'id_country', referencedColumnName: 'id' })
  country?: Country;

  /**
   * Paroisse de référence — une des paroisses suivies (invariante
   * `homeChurchId ∈ Membership(user)` validée côté service `church/`,
   * jamais ici). AUCUNE relation `@ManyToOne` vers Church : users/ ne
   * doit jamais importer church/ (AMISACHE.md §5, §7.2).
   */
  @Column({ nullable: true, name: 'home_church_id' })
  homeChurchId?: string;

  // ── Computed ──────────────────────────────────────────────

  @Expose()
  get name(): string {
    return [this.firstName, this.lastName].filter(Boolean).join(' ');
  }

  // ── Hooks ─────────────────────────────────────────────────

  @BeforeInsert()
  prepare() {
    this.email = this.email?.trim()?.toLowerCase();
    this.code = User.entityCode + Date.now();
    this.roles ??= [UserRole.user];
    this.firstName = this.firstName?.trim();
    this.lastName = this.lastName?.trim();
  }
}
