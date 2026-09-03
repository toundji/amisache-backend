// ============================================================
// AMISACHE — church.service.ts
// Nœud racine de la hiérarchie ecclésiale. Porte les règles métier
// non négociables listées dans church.entity.ts et AMISACHE.md §7.
// ============================================================
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Church } from '../entities/church.entity';
import { EntityType, ValidationStatus } from '../church.enum';
import { CountryService } from '../../address/services/country.service';
import { toAddressEntity } from '../../address/address.mapper';
import { ApiError, ApiErrorNotFoundById } from '../../utils/api-error';
import { ApiFsUtils } from '../../utils/api-fs';
import { ImageDto } from '../../shared/media.dto';
import type { Polygon } from '../../shared/geo';
import {
  CreateChurchDto,
  ListChurchAdminQuery,
  ListChurchPublicQuery,
  PaginatedChurches,
  SetPerimeterDto,
  UpdateChurchDto,
} from '../dto/church.dto';

// Ordre décroissant des niveaux « composites » (hors CHURCH/CHAPEL, qui
// sont des feuilles avec une règle de rattachement dédiée). Les niveaux
// manquants sont nativement gérés : le parent doit juste être à un rang
// strictement inférieur (index plus petit), pas forcément adjacent.
const RANKED_TYPES: EntityType[] = [
  EntityType.CONFERENCE,
  EntityType.ARCHDIOCESE,
  EntityType.DIOCESE,
  EntityType.DOYENNE,
  EntityType.PAROISSE,
  EntityType.COMMUNAUTE,
];

const LEAF_TYPES = [EntityType.CHURCH, EntityType.CHAPEL];
const LEAF_ALLOWED_PARENTS = [EntityType.PAROISSE, EntityType.COMMUNAUTE];

@Injectable()
export class ChurchService {
  constructor(
    @InjectRepository(Church) private readonly churchRepo: Repository<Church>,
    private readonly countryService: CountryService,
  ) {}

  // ── Lecture ───────────────────────────────────────────────

  /** Liste publique — uniquement les entités approuvées */
  async listPublic(query: ListChurchPublicQuery): Promise<PaginatedChurches> {
    return this.buildList({ ...query, status: ValidationStatus.APPROVED });
  }

  /** Liste admin — tous statuts, filtrable */
  async listAdmin(query: ListChurchAdminQuery): Promise<PaginatedChurches> {
    return this.buildList(query);
  }

  private async buildList(
    query: ListChurchAdminQuery,
  ): Promise<PaginatedChurches> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    let qb = this.churchRepo
      .createQueryBuilder('c')
      .skip(skip)
      .take(limit)
      .orderBy('c.name', 'ASC');

    if (query.status) qb = qb.andWhere('c.status = :status', { status: query.status });
    if (query.type) qb = qb.andWhere('c.type = :type', { type: query.type });
    if (query.parentId) qb = qb.andWhere('c.parentId = :parentId', { parentId: query.parentId });
    if (query.search?.trim()) {
      qb = qb.andWhere('c.name LIKE :term', { term: `%${query.search.trim()}%` });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getById(id: string): Promise<Church> {
    const church = await this.churchRepo.findOne({ where: { id } });
    if (!church) throw new ApiErrorNotFoundById('churches', id);
    return church;
  }

  /** Page publique par slug — 404 si absente ou non approuvée (ne révèle pas son existence) */
  async getPublicBySlug(slug: string): Promise<Church> {
    const church = await this.churchRepo.findOne({
      where: { slug, status: ValidationStatus.APPROVED },
    });
    if (!church) throw new ApiErrorNotFoundById('churches', slug);
    return church;
  }

  // ── Création / mise à jour ────────────────────────────────

  async create(body: CreateChurchDto): Promise<Church> {
    await this.validateHierarchy(body.type, body.parentId, body.countryId);

    const { address, ...rest } = body;
    const church = this.churchRepo.create({
      ...rest,
      slug: await this.prepareSlug(body.slug ?? body.name),
      address: toAddressEntity(address),
    });
    return this.churchRepo.save(church);
  }

  async update(id: string, body: UpdateChurchDto): Promise<Church> {
    await this.getById(id);

    const { address, ...rest } = body;
    const patch: Partial<Church> = { ...rest };
    if (address !== undefined) {
      patch.address = toAddressEntity(address);
    }
    if (body.slug !== undefined) {
      patch.slug = await this.prepareSlug(body.slug, id);
    }

    await this.churchRepo.update(id, patch);
    return this.getById(id);
  }

  async updateStatus(
    id: string,
    status: ValidationStatus,
  ): Promise<{ success: boolean }> {
    await this.getById(id);
    await this.churchRepo.update(id, { status });
    return { success: true };
  }

  async delete(id: string): Promise<{ success: boolean }> {
    await this.getById(id);
    // ⚠️ Le FK parent_id est en onDelete: RESTRICT — MySQL refuse la
    // suppression tant que l'entité a des enfants (ApiErrorDb propagée).
    await this.churchRepo.delete(id);
    return { success: true };
  }

  // ── Emprise géographique (§7.5) ───────────────────────────

  async setPerimeter(id: string, body: SetPerimeterDto): Promise<Church> {
    await this.getById(id);

    const ring: [number, number][] = body.points.map((p) => [p.lng, p.lat]);
    ring.push(ring[0]); // ring MySQL fermé — dernier sommet = premier

    const perimeter: Polygon = { type: 'Polygon', coordinates: [ring] };
    await this.churchRepo.update(id, { perimeter });
    return this.getById(id);
  }

  // ── Bannière ───────────────────────────────────────────────

  async updateBanner(id: string, body: ImageDto): Promise<Church> {
    const church = await this.getById(id);
    const image = body.image;
    if (image) {
      const dir = ApiFsUtils.createDir('churches');
      const key = `${Date.now()}${Math.ceil(Math.random() * 100)}`;
      const path = `${dir}/banner_${key}.${image['fileType']['ext']}`;

      ApiFsUtils.saveFile(image.path, path);

      const url = ApiFsUtils.pathToUrl(path);
      church.bannerPhoto = url;
      await this.churchRepo.update(id, { bannerPhoto: url });
    }

    return church;
  }

  // ── Règles métier privées ─────────────────────────────────

  /**
   * Le type du parent doit être à un niveau strictement supérieur
   * (les niveaux manquants sont nativement supportés). CONFERENCE est
   * la racine (pas de parent, countryId requis). CHURCH/CHAPEL sont des
   * feuilles rattachées à PAROISSE ou COMMUNAUTE — souplesse assumée.
   */
  private async validateHierarchy(
    type: EntityType,
    parentId?: string,
    countryId?: string,
  ): Promise<void> {
    if (type === EntityType.CONFERENCE) {
      if (parentId) {
        throw new ApiError('Une CONFERENCE est la racine — elle ne peut pas avoir de parent.');
      }
      if (!countryId) {
        throw new ApiError('countryId est requis pour une CONFERENCE.');
      }
      await this.countryService.getById(countryId); // 404 propre si countryId invalide
      return;
    }

    if (!parentId) {
      throw new ApiError(`Le type ${type} requiert un parent.`);
    }
    const parent = await this.getById(parentId);

    if (LEAF_TYPES.includes(type)) {
      if (!LEAF_ALLOWED_PARENTS.includes(parent.type)) {
        throw new ApiError(
          'Une église/chapelle doit être rattachée à une paroisse ou une communauté.',
        );
      }
      return;
    }

    const childRank = RANKED_TYPES.indexOf(type);
    const parentRank = RANKED_TYPES.indexOf(parent.type);
    if (parentRank === -1 || parentRank >= childRank) {
      throw new ApiError(
        `Le parent (${parent.type}) doit être à un niveau strictement supérieur à ${type}.`,
      );
    }
  }

  /** kebab-case depuis `source`, garanti unique (suffixe -2, -3... si collision) */
  private async prepareSlug(source: string, excludeId?: string): Promise<string> {
    const base = source
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // retire les accents (marques combinantes NFD)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    let slug = base;
    let suffix = 2;
    // Boucle bornée par le nombre d'entités existantes — pas de risque d'infini
    while (
      await this.churchRepo.findOne({
        where: { slug },
        ...(excludeId ? {} : {}),
      }).then((existing) => existing && existing.id !== excludeId)
    ) {
      slug = `${base}-${suffix++}`;
    }
    return slug;
  }
}
