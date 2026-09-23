// ============================================================
// AMISACHE — liturgical-period.service.ts
// Référentiel du temps liturgique + agrégat public (§4.11).
// ============================================================
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';

import { LiturgicalPeriod } from '../entities/liturgical-period.entity';
import { LiturgicalSeason } from '../../liturgy/liturgy.enum';
import { ApiErrorNotFoundById } from '../../utils/api-error';
import {
  CreateLiturgicalPeriodDto,
  LiturgicalPeriodSummary,
  LiturgicalStatus,
  UpdateLiturgicalPeriodDto,
} from '../dto/liturgical-period.dto';

@Injectable()
export class LiturgicalPeriodService {
  constructor(
    @InjectRepository(LiturgicalPeriod)
    private readonly periodRepo: Repository<LiturgicalPeriod>,
  ) {}

  // ── Public ────────────────────────────────────────────────

  /**
   * Période en cours (aujourd'hui ∈ [startDate, endDate]) et prochaine période
   * à venir, avec le nombre de paroisses ayant déjà publié un horaire spécial
   * pour cette prochaine saison. Le comptage interroge directement la table
   * `schedules` (pas d'import de `liturgy/` — même principe que
   * `GroupService.stats`, qui joint `churches` sans importer `ChurchModule`).
   */
  async getStatus(): Promise<LiturgicalStatus> {
    const today = new Date().toISOString().slice(0, 10);

    const current = await this.periodRepo.findOne({
      where: { startDate: LessThanOrEqual(today), endDate: MoreThanOrEqual(today) },
      order: { startDate: 'DESC' },
    });

    const next = await this.periodRepo.findOne({
      where: { startDate: MoreThanOrEqual(today) },
      order: { startDate: 'ASC' },
    });

    if (!next) {
      return { current: current ? this.toSummary(current) : undefined };
    }

    const churchesPublishedCount = await this.churchesPublishedCountForSeason(next.season);

    return {
      current: current ? this.toSummary(current) : undefined,
      next: { ...this.toSummary(next), churchesPublishedCount },
    };
  }

  private async churchesPublishedCountForSeason(season: LiturgicalSeason): Promise<number> {
    const rows: { count: string }[] = await this.periodRepo.manager.query(
      'SELECT COUNT(DISTINCT church_id) AS count FROM schedules WHERE season = ?',
      [season],
    );
    return Number(rows[0]?.count ?? 0);
  }

  private toSummary(period: LiturgicalPeriod): LiturgicalPeriodSummary {
    return {
      id: period.id,
      name: period.name,
      season: period.season,
      startDate: period.startDate,
      endDate: period.endDate,
    };
  }

  // ── Admin ─────────────────────────────────────────────────

  async listAdmin(): Promise<LiturgicalPeriod[]> {
    return this.periodRepo.find({ order: { startDate: 'ASC' } });
  }

  async getById(id: string): Promise<LiturgicalPeriod> {
    const period = await this.periodRepo.findOne({ where: { id } });
    if (!period) throw new ApiErrorNotFoundById('liturgical_periods', id);
    return period;
  }

  async create(body: CreateLiturgicalPeriodDto): Promise<LiturgicalPeriod> {
    const period = this.periodRepo.create(body);
    return this.periodRepo.save(period);
  }

  async update(id: string, body: UpdateLiturgicalPeriodDto): Promise<LiturgicalPeriod> {
    await this.getById(id);
    await this.periodRepo.update(id, body);
    return this.getById(id);
  }

  async delete(id: string): Promise<{ success: boolean }> {
    await this.getById(id);
    await this.periodRepo.delete(id);
    return { success: true };
  }
}
