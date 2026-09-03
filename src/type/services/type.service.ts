// ============================================================
// AMISACHE — type.service.ts
// Lecture publique des types actifs (par scope) + CRUD admin.
// ============================================================
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Type } from '../entities/type.entity';
import { TypeScope } from '../type.enum';
import { ApiError, ApiErrorNotFoundById } from '../../utils/api-error';
import {
  CreateTypeDto,
  ListTypeAdminQuery,
  ListTypePublicQuery,
  PaginatedTypes,
  UpdateTypeDto,
} from '../dto/type.dto';

@Injectable()
export class TypeService {
  constructor(
    @InjectRepository(Type) private readonly typeRepo: Repository<Type>,
  ) {}

  // ── Public ────────────────────────────────────────────────

  /**
   * Liste les types actifs, filtrés par scope.
   * Utilisé par les modules métier pour peupler leurs sélecteurs
   * (intention, sacrement, don, publication, horaire).
   */
  async listActive(query: ListTypePublicQuery): Promise<Type[]> {
    const where: Record<string, unknown> = { active: true };
    if (query.scope) where.scope = query.scope;

    return this.typeRepo.find({
      where,
      order: { name: 'ASC' },
    });
  }

  /** Vérifie qu'un typeId existe et appartient à un des scopes attendus. */
  async assertScope(typeId: string, scope: TypeScope | TypeScope[]): Promise<Type> {
    const type = await this.typeRepo.findOne({ where: { id: typeId } });
    if (!type) throw new ApiErrorNotFoundById('types', typeId);
    const allowed = Array.isArray(scope) ? scope : [scope];
    if (!allowed.includes(type.scope)) {
      throw new ApiError(`Ce type n'appartient pas au scope ${allowed.join('/')}.`);
    }
    return type;
  }

  // ── Admin — liste / détail ────────────────────────────────

  async listAdmin(query: ListTypeAdminQuery): Promise<PaginatedTypes> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    let qb = this.typeRepo
      .createQueryBuilder('t')
      .skip(skip)
      .take(limit)
      .orderBy('t.scope', 'ASC')
      .addOrderBy('t.name', 'ASC');

    if (query.scope) {
      qb = qb.andWhere('t.scope = :scope', { scope: query.scope });
    }
    if (query.active !== undefined) {
      qb = qb.andWhere('t.active = :active', { active: query.active });
    }
    if (query.search?.trim()) {
      qb = qb.andWhere('t.name LIKE :term', {
        term: `%${query.search.trim()}%`,
      });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getById(id: string): Promise<Type> {
    const type = await this.typeRepo.findOne({ where: { id } });
    if (!type) throw new ApiErrorNotFoundById('types', id);
    return type;
  }

  // ── Admin — création / mise à jour / suppression ──────────

  async create(body: CreateTypeDto): Promise<Type> {
    const type = this.typeRepo.create(body);
    return this.typeRepo.save(type);
  }

  async update(id: string, body: UpdateTypeDto): Promise<Type> {
    await this.getById(id);
    await this.typeRepo.update(id, body);
    return this.getById(id);
  }

  async delete(id: string): Promise<{ success: boolean }> {
    await this.getById(id);
    await this.typeRepo.delete(id);
    return { success: true };
  }
}
