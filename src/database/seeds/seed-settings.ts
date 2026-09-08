// ============================================================
// seed-settings.ts
// Constantes / variables de configuration de l'app (content/Setting),
// pilotables sans redéploiement. Clé unique.
//
// Idempotent : une clé déjà présente n'est PAS écrasée (on ne veut pas
// perdre une valeur ajustée en prod). `--refresh` réécrit chaque ligne
// aux valeurs de seed ci-dessous.
//
// `value` est toujours du texte brut, interprété via `type` côté
// SettingService.parseValue.
// ============================================================
import { DataSource } from 'typeorm';
import { Setting } from '../../content/entities/setting.entity';
import { SettingType } from '../../shared/common.enum';

interface SeedSetting {
  key: string;
  value: string;
  type: SettingType;
  category: string;
  label: string;
  description?: string;
  isPublic: boolean;
  /** false = constante posée au seed, non modifiable via le panel. */
  isEditable: boolean;
}

const SETTINGS: SeedSetting[] = [
  // ── Général ────────────────────────────────────────────────
  { key: 'APP_NAME', value: 'Amisache', type: SettingType.string, category: 'general', label: "Nom de l'application", isPublic: true, isEditable: true },
  { key: 'APP_TAGLINE', value: 'Mon église', type: SettingType.string, category: 'general', label: 'Slogan', isPublic: true, isEditable: true },
  { key: 'MAINTENANCE_MODE', value: 'false', type: SettingType.boolean, category: 'general', label: 'Mode maintenance', description: 'Bloque l\'accès à l\'app cliente si activé.', isPublic: true, isEditable: true },
  { key: 'DEFAULT_COUNTRY_ISO', value: 'BJ', type: SettingType.string, category: 'general', label: 'Pays par défaut (ISO)', isPublic: true, isEditable: false },
  { key: 'DEFAULT_LANGUAGE', value: 'fr', type: SettingType.string, category: 'general', label: 'Langue par défaut', isPublic: true, isEditable: true },

  // ── Contact ────────────────────────────────────────────────
  { key: 'SUPPORT_EMAIL', value: 'contact@amisache.org', type: SettingType.string, category: 'contact', label: 'Email de contact', isPublic: true, isEditable: true },
  { key: 'SUPPORT_PHONE', value: '', type: SettingType.string, category: 'contact', label: 'Téléphone de contact', isPublic: true, isEditable: true },
  { key: 'CONTACT_ADDRESS', value: '', type: SettingType.string, category: 'contact', label: 'Adresse postale', isPublic: true, isEditable: true },
  { key: 'FACEBOOK_URL', value: '', type: SettingType.string, category: 'contact', label: 'Page Facebook', isPublic: true, isEditable: true },
  { key: 'YOUTUBE_URL', value: '', type: SettingType.string, category: 'contact', label: 'Chaîne YouTube', isPublic: true, isEditable: true },
  { key: 'WHATSAPP_NUMBER', value: '', type: SettingType.string, category: 'contact', label: 'Numéro WhatsApp', isPublic: true, isEditable: true },

  // ── Paiement ───────────────────────────────────────────────
  { key: 'CURRENCY_CODE', value: 'XOF', type: SettingType.string, category: 'payment', label: 'Devise (ISO 4217)', isPublic: true, isEditable: false },
  { key: 'CURRENCY_SYMBOL', value: 'F CFA', type: SettingType.string, category: 'payment', label: 'Symbole monétaire', isPublic: true, isEditable: false },
  { key: 'PAYMENT_CONFIRMATION_MODE', value: 'MANUAL', type: SettingType.string, category: 'payment', label: 'Mode de confirmation des paiements', description: 'MANUAL = flux déclaratif validé par le clergé (§4.7).', isPublic: false, isEditable: false },
  { key: 'MIN_DONATION_AMOUNT', value: '100', type: SettingType.number, category: 'payment', label: 'Montant minimum d\'un don', isPublic: true, isEditable: true },

  // ── Modération ─────────────────────────────────────────────
  { key: 'CHURCH_APPROVAL_REQUIRED', value: 'true', type: SettingType.boolean, category: 'moderation', label: 'Validation admin des nouvelles entités', description: 'Une entité créée reste en PENDING tant qu\'un admin ne l\'approuve pas.', isPublic: false, isEditable: true },
];

export async function seedSettings(dataSource: DataSource, refresh: boolean): Promise<void> {
  const repo = dataSource.getRepository(Setting);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const s of SETTINGS) {
    const existing = await repo.findOne({ where: { key: s.key } });

    if (existing) {
      if (refresh) {
        await repo.update(existing.id, {
          value: s.value,
          type: s.type,
          category: s.category,
          label: s.label,
          description: s.description ?? undefined,
          isPublic: s.isPublic,
          isEditable: s.isEditable,
        });
        updated += 1;
      } else {
        skipped += 1;
      }
      continue;
    }

    await repo.save(repo.create(s));
    created += 1;
  }

  console.log(
    `Settings seedés : ${created} créé(s), ${updated} réécrit(s), ${skipped} déjà présent(s).`,
  );
}
