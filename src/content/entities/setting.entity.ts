// ============================================================
// UNIFIED AUTH — setting.entity.ts
// Constantes et variables de configuration de l'application,
// pilotables sans redéploiement (contrairement à .env).
// Stockage clé/valeur — `value` est toujours du texte brut,
// typé/interprété via `type` (voir SettingService.parseValue).
// ============================================================
import { Entity, Column } from 'typeorm';
import { Audit } from '../../shared/audit';
import { SettingType } from '../../shared/common.enum';

@Entity('settings')
export class Setting extends Audit {
  static entityName = 'settings';

  /** Identifiant unique, ex. "APP_MAINTENANCE_MODE" — utilisé comme clé de lookup */
  @Column({ unique: true })
  key!: string;

  @Column({ type: 'text', nullable: true })
  value?: string;

  @Column({ type: 'enum', enum: SettingType, default: SettingType.string })
  type!: SettingType;

  /** Regroupement libre pour l'affichage admin, ex. "general", "mail", "payment" */
  @Column({ nullable: true })
  category?: string;

  /** Libellé lisible affiché dans le panel admin */
  @Column({ nullable: true })
  label?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  /**
   * true → exposé sans authentification sur la route publique
   * (config nécessaire au frontend avant login : nom d'app, feature flags...).
   * false → lisible uniquement par l'admin (clés API, seuils internes...).
   */
  @Column({ name: 'is_public', default: false })
  isPublic!: boolean;

  /**
   * false → constante protégée : visible mais non modifiable via le panel admin.
   * Distingue les vraies "constantes" (posées au seed, immuables) des "variables"
   * de configuration ajustables en cours de vie de l'application.
   */
  @Column({ name: 'is_editable', default: true })
  isEditable!: boolean;
}
