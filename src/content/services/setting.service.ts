// ============================================================
// UNIFIED AUTH — setting.service.ts
// CRUD admin + lecture publique des settings, avec (dé)sérialisation
// de `value` (toujours stockée en texte) selon `type`.
// ============================================================
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Setting } from '../entities/setting.entity';
import { SettingType } from '../../shared/common.enum';
import { ApiError, ApiErrorNotFoundById } from '../../utils/api-error';
import {
  CreateSettingDto,
  ListSettingAdminQuery,
  PaginatedSettings,
  UpdateSettingDto,
} from '../dto/setting.dto';

export type SettingValue =
  | string
  | number
  | boolean
  | Record<string, unknown>
  | null;

@Injectable()
export class SettingService {
  constructor(
    @InjectRepository(Setting)
    private readonly settingRepo: Repository<Setting>,
  ) {}

  // ── (dé)sérialisation ─────────────────────────────────────

  /** Interprète `value` (toujours du texte en base) selon `type`. */
  parseValue(setting: Setting): SettingValue {
    if (setting.value === null || setting.value === undefined) return null;

    switch (setting.type) {
      case SettingType.number: {
        const n = Number(setting.value);
        return Number.isNaN(n) ? null : n;
      }
      case SettingType.boolean:
        return setting.value === 'true';
      case SettingType.json:
        try {
          return JSON.parse(setting.value) as Record<string, unknown>;
        } catch {
          return null;
        }
      default:
        return setting.value;
    }
  }

  // ── Public ────────────────────────────────────────────────

  /** Renvoie un objet { KEY: value } prêt à consommer côté frontend, valeurs typées. */
  async getPublicMap(): Promise<Record<string, SettingValue>> {
    const settings = await this.settingRepo.find({ where: { isPublic: true } });
    return Object.fromEntries(settings.map((s) => [s.key, this.parseValue(s)]));
  }

  // ── Admin — liste / détail ────────────────────────────────

  async listAdmin(query: ListSettingAdminQuery): Promise<PaginatedSettings> {
    let qb = this.settingRepo.createQueryBuilder('s').orderBy('s.key', 'ASC');

    if (query.category) {
      qb = qb.andWhere('s.category = :category', { category: query.category });
    }
    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      qb = qb.andWhere('(s.key LIKE :term OR s.label LIKE :term)', { term });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async getById(id: string): Promise<Setting> {
    const setting = await this.settingRepo.findOne({ where: { id } });
    if (!setting) throw new ApiErrorNotFoundById('settings', id);
    return setting;
  }

  async getByKey(key: string): Promise<Setting> {
    const setting = await this.settingRepo.findOne({ where: { key } });
    if (!setting) throw new ApiErrorNotFoundById('settings', key);
    return setting;
  }

  // ── Admin — création / mise à jour / suppression ──────────

  async create(body: CreateSettingDto): Promise<Setting> {
    const existing = await this.settingRepo.findOne({
      where: { key: body.key },
    });
    if (existing) {
      throw new ApiError(`La clé "${body.key}" existe déjà.`, {
        code: HttpStatus.CONFLICT,
        entity: 'settings',
        displayable: true,
      });
    }

    const setting = this.settingRepo.create({
      ...body,
      type: body.type ?? SettingType.string,
    });
    return this.settingRepo.save(setting);
  }

  async update(id: string, body: UpdateSettingDto): Promise<Setting> {
    const setting = await this.getById(id);

    // Une "constante" (isEditable=false) ne peut plus voir sa valeur changer
    // via l'API — seuls les champs descriptifs restent modifiables.
    const patch: Partial<Setting> = { ...body };
    if (!setting.isEditable && body.value !== undefined) {
      delete patch.value;
    }

    await this.settingRepo.update(id, patch);
    return this.getById(id);
  }

  async delete(id: string): Promise<{ success: boolean }> {
    await this.getById(id);
    await this.settingRepo.delete(id);
    return { success: true };
  }
}
