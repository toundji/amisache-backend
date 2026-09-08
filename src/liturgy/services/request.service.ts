// ============================================================
// AMISACHE — request.service.ts
// Demande unifiée (intention de messe / sacrement). Voir
// cahier-des-charges §4.6.
// ============================================================
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Request } from '../entities/request.entity';
import { RequestStatus } from '../liturgy.enum';
import { isValidScheduleOccurrence } from '../liturgy.util';
import { ScheduleService } from './schedule.service';
import { ChurchService } from '../../church/services/church.service';
import { ClergyMemberService } from '../../church/services/clergy-member.service';
import { TypeService } from '../../type/services/type.service';
import { TypeScope } from '../../type/type.enum';
import { PaymentService } from '../../payment/services/payment.service';
import { ApiError, ApiErrorNotFoundById } from '../../utils/api-error';
import { JwtUserInfo } from '../../auth/dto/auth.type.dto';
import { CreateRequestDto, ListRequestQuery, UpdateRequestStatusDto } from '../dto/request.dto';

@Injectable()
export class RequestService {
  constructor(
    @InjectRepository(Request) private readonly requestRepo: Repository<Request>,
    private readonly churchService: ChurchService,
    private readonly clergyMemberService: ClergyMemberService,
    private readonly scheduleService: ScheduleService,
    private readonly typeService: TypeService,
    private readonly paymentService: PaymentService,
  ) {}

  async listMine(userId: string): Promise<Request[]> {
    return this.requestRepo.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  /**
   * [Admin] Liste complète des demandes, toutes églises. Filtre `status`
   * disponible. `churchId` reste accepté (déprécié — préférer
   * `GET /requests/church/:churchId`).
   */
  async listAdmin(query: ListRequestQuery = {}): Promise<Request[]> {
    return this.requestRepo.find({
      where: {
        ...(query.churchId ? { churchId: query.churchId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Liste complète des demandes d'UNE église — réservée au clergé ACTIF de
   * cette église (ou admin/engineer). 404 si l'église est inconnue.
   */
  async listForChurch(
    user: JwtUserInfo,
    churchId: string,
    query: ListRequestQuery = {},
  ): Promise<Request[]> {
    await this.churchService.getById(churchId);
    await this.clergyMemberService.assertAuthorizedForChurch(user, churchId);
    return this.requestRepo.find({
      where: {
        churchId,
        ...(query.status ? { status: query.status } : {}),
      },
      order: { createdAt: 'DESC' },
    });
  }

  /** Lecture par id — réservée au demandeur lui-même (l'admin passe par getById) */
  async getMineById(id: string, userId: string): Promise<Request> {
    const request = await this.getById(id);
    if (request.userId !== userId) {
      throw new ApiErrorNotFoundById('requests', id); // 404, pas 403 — n'expose pas l'existence
    }
    return request;
  }

  async getById(id: string): Promise<Request> {
    const request = await this.requestRepo.findOne({ where: { id } });
    if (!request) throw new ApiErrorNotFoundById('requests', id);
    return request;
  }

  async create(userId: string, body: CreateRequestDto): Promise<Request> {
    await this.churchService.getById(body.churchId); // 404 propre si churchId invalide
    await this.typeService.assertScope(body.typeId, [
      TypeScope.INTENTION,
      TypeScope.SACRAMENT,
    ]);

    if (body.scheduleId) {
      const schedule = await this.scheduleService.getById(body.scheduleId);
      if (schedule.churchId !== body.churchId) {
        throw new ApiError("L'horaire choisi n'appartient pas à cette église.");
      }
      if (!isValidScheduleOccurrence(schedule, body.date)) {
        throw new ApiError(
          'La date choisie ne correspond à aucune occurrence de cet horaire.',
        );
      }
    }

    let paymentId: string | undefined;
    if (body.payment) {
      const payment = await this.paymentService.submit(body.payment, body.churchId);
      paymentId = payment.id;
    }

    const request = this.requestRepo.create({
      date: body.date,
      text: body.text,
      offering: body.offering?.toFixed(2),
      attachments: body.attachments,
      churchId: body.churchId,
      userId,
      scheduleId: body.scheduleId,
      typeId: body.typeId,
      paymentId,
    });
    return this.requestRepo.save(request);
  }

  async updateStatus(id: string, body: UpdateRequestStatusDto): Promise<{ success: boolean }> {
    await this.getById(id);
    await this.requestRepo.update(id, { status: body.status as RequestStatus });
    return { success: true };
  }
}
