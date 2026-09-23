// ============================================================
// AMISACHE — schedule.service.ts
// Horaires liturgiques récurrents.
// ============================================================
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Schedule } from '../entities/schedule.entity';
import { ScheduleFrequency } from '../liturgy.enum';
import { nextScheduleOccurrence } from '../liturgy.util';
import { ChurchService } from '../../church/services/church.service';
import { ClergyMemberService } from '../../church/services/clergy-member.service';
import { TypeService } from '../../type/services/type.service';
import { TypeScope } from '../../type/type.enum';
import { ApiError, ApiErrorNotFoundById } from '../../utils/api-error';
import { JwtUserInfo } from '../../auth/dto/auth.type.dto';
import {
  CreateScheduleDto,
  ListNearbyScheduleQuery,
  ListScheduleQuery,
  NearbySchedule,
  UpdateScheduleDto,
} from '../dto/schedule.dto';

@Injectable()
export class ScheduleService {
  constructor(
    @InjectRepository(Schedule) private readonly scheduleRepo: Repository<Schedule>,
    private readonly churchService: ChurchService,
    private readonly clergyMemberService: ClergyMemberService,
    private readonly typeService: TypeService,
  ) {}

  async list(query: ListScheduleQuery): Promise<Schedule[]> {
    return this.scheduleRepo.find({
      where: { churchId: query.churchId },
      order: { dayOfWeek: 'ASC', time: 'ASC' },
    });
  }

  /** [Admin] Liste complète, toutes églises confondues. */
  async listAdmin(): Promise<Schedule[]> {
    return this.scheduleRepo.find({ order: { dayOfWeek: 'ASC', time: 'ASC' } });
  }

  /**
   * Liste complète des horaires d'UNE église — réservée au clergé ACTIF de
   * cette église (ou admin/engineer). 404 si l'église est inconnue.
   */
  async listForChurch(user: JwtUserInfo, churchId: string): Promise<Schedule[]> {
    await this.churchService.getById(churchId);
    await this.clergyMemberService.assertAuthorizedForChurch(user, churchId);
    return this.scheduleRepo.find({
      where: { churchId },
      order: { dayOfWeek: 'ASC', time: 'ASC' },
    });
  }

  /**
   * Prochaines célébrations à proximité d'un point, toutes églises
   * confondues, triées par horaire (§4.11 « Messes autour de vous »).
   * Bornée à un nombre restreint d'églises candidates (30) pour ne pas
   * calculer d'occurrences sur un rayon trop large.
   */
  async nearby(query: ListNearbyScheduleQuery): Promise<NearbySchedule[]> {
    const lat = Number(query.lat);
    const lng = Number(query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new ApiError('lat et lng sont requis et doivent être des nombres.');
    }
    const radiusKm = query.radiusKm ? Number(query.radiusKm) : 15;
    const limit = query.limit ? Math.min(20, Number(query.limit)) : 6;

    const nearbyChurches = await this.churchService.findNearby(lat, lng, radiusKm, 30);
    if (nearbyChurches.length === 0) return [];

    const churchIds = nearbyChurches.map(({ church }) => church.id);
    const byChurchId = new Map(nearbyChurches.map((n) => [n.church.id, n]));

    const schedules = await this.scheduleRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.type', 'type')
      .where('s.churchId IN (:...churchIds)', { churchIds })
      .getMany();

    const now = new Date();
    const results: NearbySchedule[] = [];

    for (const schedule of schedules) {
      const occurrence = nextScheduleOccurrence(schedule, now);
      if (!occurrence) continue;

      const nearby = byChurchId.get(schedule.churchId);
      if (!nearby) continue;

      results.push({
        scheduleId: schedule.id,
        churchId: nearby.church.id,
        churchName: nearby.church.name,
        churchSlug: nearby.church.slug,
        locality: nearby.church.address?.locality,
        distanceKm: Math.round(nearby.distanceKm * 10) / 10,
        time: schedule.time,
        durationMinutes: schedule.duration,
        occurrenceAt: occurrence.toISOString(),
        language: schedule.language,
        typeName: schedule.type?.name,
      });
    }

    results.sort((a, b) => a.occurrenceAt.localeCompare(b.occurrenceAt));
    return results.slice(0, limit);
  }

  async getById(id: string): Promise<Schedule> {
    const schedule = await this.scheduleRepo.findOne({ where: { id } });
    if (!schedule) throw new ApiErrorNotFoundById('schedules', id);
    return schedule;
  }

  async create(user: JwtUserInfo, body: CreateScheduleDto): Promise<Schedule> {
    await this.churchService.getById(body.churchId); // 404 propre si churchId invalide
    await this.clergyMemberService.assertAuthorizedForChurch(user, body.churchId);
    await this.typeService.assertScope(body.typeId, TypeScope.SCHEDULE);
    this.assertRecurrenceFields(body.frequency, body.dayOfWeek, body.weekOfMonth);

    if (body.frequency === ScheduleFrequency.ONCE && !body.startDate) {
      throw new ApiError(
        'startDate est requis pour une fréquence ONCE (date unique de la célébration).',
      );
    }

    const schedule = this.scheduleRepo.create(body);
    return this.scheduleRepo.save(schedule);
  }

  async update(user: JwtUserInfo, id: string, body: UpdateScheduleDto): Promise<Schedule> {
    const existing = await this.getById(id);
    await this.clergyMemberService.assertAuthorizedForChurch(user, existing.churchId);
    this.assertRecurrenceFields(
      body.frequency ?? existing.frequency,
      body.dayOfWeek ?? existing.dayOfWeek,
      body.weekOfMonth ?? existing.weekOfMonth,
    );

    await this.scheduleRepo.update(id, body);
    return this.getById(id);
  }

  async delete(user: JwtUserInfo, id: string): Promise<{ success: boolean }> {
    const existing = await this.getById(id);
    await this.clergyMemberService.assertAuthorizedForChurch(user, existing.churchId);
    await this.scheduleRepo.delete(id);
    return { success: true };
  }

  /** Cohérence recurrence/fréquence — cahier-des-charges §4.5 */
  private assertRecurrenceFields(
    frequency: ScheduleFrequency,
    dayOfWeek?: number,
    weekOfMonth?: number,
  ): void {
    const needsDayOfWeek = [
      ScheduleFrequency.WEEKLY,
      ScheduleFrequency.BIWEEKLY,
      ScheduleFrequency.MONTHLY,
    ].includes(frequency);

    if (needsDayOfWeek && dayOfWeek == null) {
      throw new ApiError(`dayOfWeek est requis pour la fréquence ${frequency}.`);
    }
    if (frequency === ScheduleFrequency.MONTHLY && weekOfMonth == null) {
      throw new ApiError('weekOfMonth est requis pour la fréquence MONTHLY.');
    }
  }
}
