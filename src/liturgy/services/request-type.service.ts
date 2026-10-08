// ============================================================
// AMISACHE — request-type.service.ts
// Lecture publique des types de demande actifs (par scope) + CRUD admin.
// Table dédiée (request_types), sortie de la table mutualisée `types` — voir
// request-type.entity.ts.
// ============================================================
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { RequestType } from '../entities/request-type.entity';
import { ApiErrorNotFoundById } from '../../utils/api-error';
import {
  CreateRequestTypeDto,
  ListRequestTypeAdminQuery,
  ListRequestTypePublicQuery,
  PaginatedRequestTypes,
  UpdateRequestTypeDto,
} from '../dto/request-type.dto';

@Injectable()
export class RequestTypeService {
  constructor(
    @InjectRepository(RequestType) private readonly requestTypeRepo: Repository<RequestType>,
  ) {}

  // ── Public ────────────────────────────────────────────────

  /**
   * Liste les types actifs, filtrés par scope (intention/sacrement) — sans
   * filtre, renvoie les deux. Alimente le formulaire de demande et
   * l'assistant du chat.
   */
  async listActive(query: ListRequestTypePublicQuery = {}): Promise<RequestType[]> {
    const where: Record<string, unknown> = { active: true };
    if (query.scope) where.scope = query.scope;

    return this.requestTypeRepo.find({
      where,
      order: { name: 'ASC' },
    });
  }

  // ── Admin — liste / détail ────────────────────────────────

  async listAdmin(query: ListRequestTypeAdminQuery): Promise<PaginatedRequestTypes> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    let qb = this.requestTypeRepo
      .createQueryBuilder('rt')
      .skip(skip)
      .take(limit)
      .orderBy('rt.scope', 'ASC')
      .addOrderBy('rt.name', 'ASC');

    if (query.scope) {
      qb = qb.andWhere('rt.scope = :scope', { scope: query.scope });
    }
    if (query.active !== undefined) {
      qb = qb.andWhere('rt.active = :active', { active: query.active });
    }
    if (query.search?.trim()) {
      qb = qb.andWhere('rt.name LIKE :term', {
        term: `%${query.search.trim()}%`,
      });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getById(id: string): Promise<RequestType> {
    const type = await this.requestTypeRepo.findOne({ where: { id } });
    if (!type) throw new ApiErrorNotFoundById('request_types', id);
    return type;
  }

  // ── Admin — création / mise à jour / suppression ──────────

  async create(body: CreateRequestTypeDto): Promise<RequestType> {
    const type = this.requestTypeRepo.create(body);
    return this.requestTypeRepo.save(type);
  }

  async update(id: string, body: UpdateRequestTypeDto): Promise<RequestType> {
    await this.getById(id);
    await this.requestTypeRepo.update(id, body);
    return this.getById(id);
  }

  async delete(id: string): Promise<{ success: boolean }> {
    await this.getById(id);
    await this.requestTypeRepo.delete(id);
    return { success: true };
  }
}
