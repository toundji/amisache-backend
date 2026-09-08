// ============================================================
// AMISACHE — schedule.service.ts
// Horaires liturgiques récurrents.
// ============================================================
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Schedule } from '../entities/schedule.entity';
import { ScheduleFrequency } from '../liturgy.enum';
import { ChurchService } from '../../church/services/church.service';
import { ClergyMemberService } from '../../church/services/clergy-member.service';
import { TypeService } from '../../type/services/type.service';
import { TypeScope } from '../../type/type.enum';
import { ApiError, ApiErrorNotFoundById } from '../../utils/api-error';
import { JwtUserInfo } from '../../auth/dto/auth.type.dto';
import { CreateScheduleDto, ListScheduleQuery, UpdateScheduleDto } from '../dto/schedule.dto';

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
