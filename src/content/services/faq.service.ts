// ============================================================
// UNIFIED AUTH — faq.service.ts
// Lecture publique des FAQ répondues + CRUD admin.
// Une FAQ est publique quand answeredAt est renseigné (answer non vide)
// ET hiddenAt est vide (pas masquée manuellement).
// ============================================================
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

import { Faq } from '../entities/faq.entity';
import { FaqCategory } from '../../shared/common.enum';
import { ApiErrorNotFoundById } from '../../utils/api-error';
import {
  CreateFaqDto,
  ListFaqAdminQuery,
  ListFaqPublicQuery,
  PaginatedFaqs,
  UpdateFaqDto,
} from '../dto/faq.dto';

@Injectable()
export class FaqService {
  constructor(
    @InjectRepository(Faq) private readonly faqRepo: Repository<Faq>,
  ) {}

  // ── Public ────────────────────────────────────────────────

  async listPublished(query: ListFaqPublicQuery): Promise<Faq[]> {
    const where: Record<string, unknown> = {
      answeredAt: Not(IsNull()),
      hiddenAt: IsNull(),
    };
    if (query.category) where.category = query.category;

    return this.faqRepo.find({
      where,
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  // ── Admin — liste / détail ────────────────────────────────

  async listAdmin(query: ListFaqAdminQuery): Promise<PaginatedFaqs> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    let qb = this.faqRepo
      .createQueryBuilder('f')
      .skip(skip)
      .take(limit)
      .orderBy('f.sortOrder', 'ASC')
      .addOrderBy('f.createdAt', 'ASC');

    if (query.category) {
      qb = qb.andWhere('f.category = :category', { category: query.category });
    }

    if (query.answered !== undefined) {
      const answered =
        query.answered === true || (query.answered as unknown) === 'true';
      qb = answered
        ? qb.andWhere('f.answeredAt IS NOT NULL')
        : qb.andWhere('f.answeredAt IS NULL');
    }

    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      qb = qb.andWhere('(f.question LIKE :term OR f.answer LIKE :term)', {
        term,
      });
    }

    const [data, total] = await qb.getManyAndCount();

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getById(id: string): Promise<Faq> {
    const faq = await this.faqRepo.findOne({ where: { id } });
    if (!faq) throw new ApiErrorNotFoundById('faqs', id);
    return faq;
  }

  // ── Admin — création / mise à jour / suppression ──────────

  async create(body: CreateFaqDto): Promise<Faq> {
    const faq = this.faqRepo.create({
      ...body,
      answeredAt: body.answer?.trim() ? new Date() : undefined,
    });
    return this.faqRepo.save(faq);
  }

  async update(id: string, body: UpdateFaqDto): Promise<Faq> {
    const faq = await this.getById(id);
    const { hidden, ...rest } = body;

    const patch: {
      question?: string;
      answer?: string;
      category?: FaqCategory | null;
      sortOrder?: number;
      answeredAt?: Date | null;
      hiddenAt?: Date | null;
    } = { ...rest };
    if (body.answer !== undefined) {
      if (body.answer.trim()) {
        if (!faq.answeredAt) patch.answeredAt = new Date();
      } else {
        patch.answeredAt = null;
      }
    }
    if (hidden === true && !faq.hiddenAt) {
      patch.hiddenAt = new Date();
    } else if (hidden === false) {
      patch.hiddenAt = null;
    }

    await this.faqRepo.update(id, patch as QueryDeepPartialEntity<Faq>);
    return this.getById(id);
  }

  async delete(id: string): Promise<{ success: boolean }> {
    await this.getById(id);
    await this.faqRepo.delete(id);
    return { success: true };
  }
}
