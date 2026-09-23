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
import { TariffService } from './tariff.service';
import { ApiError, ApiErrorNotFoundById } from '../../utils/api-error';
import { ApiFsUtils } from '../../utils/api-fs';
import { JwtUserInfo } from '../../auth/dto/auth.type.dto';
import {
  CreateRequestDto,
  ListRequestQuery,
  RequestAttachmentUploadDto,
  UpdateRequestStatusDto,
} from '../dto/request.dto';

@Injectable()
export class RequestService {
  constructor(
    @InjectRepository(Request) private readonly requestRepo: Repository<Request>,
    private readonly churchService: ChurchService,
    private readonly clergyMemberService: ClergyMemberService,
    private readonly scheduleService: ScheduleService,
    private readonly typeService: TypeService,
    private readonly paymentService: PaymentService,
    private readonly tariffService: TariffService,
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
      relations: { user: true },
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
      relations: { user: true },
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

  /**
   * Lecture par id pour un compte non admin/engineer : le demandeur
   * lui-même, OU le clergé ACTIF de l'église de cette demande (doit pouvoir
   * ouvrir le détail d'une demande qui lui est adressée, pas seulement la
   * lister — cf. `RequestController.getById`).
   */
  async getByIdForRequesterOrClergy(id: string, user: JwtUserInfo): Promise<Request> {
    const request = await this.getById(id);
    if (request.userId === user.id) return request;
    try {
      await this.clergyMemberService.assertAuthorizedForChurch(user, request.churchId);
    } catch {
      throw new ApiErrorNotFoundById('requests', id); // 404, pas 403 — n'expose pas l'existence
    }
    return request;
  }

  async getById(id: string): Promise<Request> {
    const request = await this.requestRepo.findOne({
      where: { id },
      relations: { user: true, church: true, type: true, payment: true },
    });
    if (!request) throw new ApiErrorNotFoundById('requests', id);
    return request;
  }

  async create(userId: string, body: CreateRequestDto): Promise<Request> {
    await this.churchService.getById(body.churchId); // 404 propre si churchId invalide
    const type = await this.typeService.assertScope(body.typeId, [
      TypeScope.INTENTION,
      TypeScope.SACRAMENT,
    ]);

    // Célébration à domicile — seuls les types explicitement éligibles
    // (Type.allowHomeCelebration, réglé depuis le panel) peuvent la demander.
    if (body.homeAddress && !type.allowHomeCelebration) {
      throw new ApiError(
        `« ${type.name} » ne peut pas être célébré à domicile — merci de choisir une célébration à l'église.`,
      );
    }

    // Délai minimum avant la date souhaitée — variable par type (mariage,
    // baptême... demandent plus de préparation qu'une intention simple).
    const minDate = this.addDays(this.today(), type.minLeadDays);
    if (body.date < minDate) {
      throw new ApiError(
        type.minLeadDays > 0
          ? `« ${type.name} » doit être demandé au moins ${type.minLeadDays} jour(s) avant la date souhaitée.`
          : `La date souhaitée ne peut pas être antérieure à aujourd'hui.`,
      );
    }

    // La date doit correspondre à une messe déjà programmée par cette
    // paroisse — seulement si le type l'exige ET que la paroisse a
    // effectivement publié un horaire (sinon la date reste libre).
    if (type.requiresScheduleMatch) {
      const schedules = await this.scheduleService.list({ churchId: body.churchId });
      if (schedules.length > 0 && !schedules.some((s) => isValidScheduleOccurrence(s, body.date))) {
        throw new ApiError(
          'La date choisie ne correspond à aucune messe déjà programmée par cette paroisse — merci de choisir une date de son horaire publié.',
        );
      }
    }

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
      // Un tarif défini (par cette église, ou par repli hiérarchique — voir
      // TariffService.resolve) prime toujours sur le montant envoyé par le
      // client : ce dernier ne doit jamais pouvoir imposer son propre prix
      // quand l'église en a publié un.
      const tariff = await this.tariffService.resolve(body.churchId, body.typeId);
      const payment = await this.paymentService.submit(
        tariff ? { ...body.payment, amount: tariff.amount } : body.payment,
        body.churchId,
      );
      paymentId = payment.id;
    }

    const request = this.requestRepo.create({
      date: body.date,
      text: body.text,
      offering: body.offering?.toFixed(2),
      attachments: body.attachments,
      homeAddress: body.homeAddress,
      homeLocation: body.homeLocation
        ? { type: 'Point', coordinates: [body.homeLocation.lng, body.homeLocation.lat] }
        : undefined,
      churchId: body.churchId,
      userId,
      scheduleId: body.scheduleId,
      typeId: body.typeId,
      paymentId,
    });
    return this.requestRepo.save(request);
  }

  /** Date du jour au format YYYY-MM-DD (comparable directement à `Request.date`, une simple chaîne). */
  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private addDays(dateStr: string, days: number): string {
    const date = new Date(`${dateStr}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  /**
   * Upload d'une pièce jointe libre (prière, contenu spécifique — image ou
   * PDF) avant soumission de la demande. Distinct du reçu de paiement (voir
   * payment/services/payment.service.ts::uploadReceiptImage).
   */
  async uploadAttachment(body: RequestAttachmentUploadDto): Promise<{ url: string }> {
    const file = body.attachment;
    const dir = ApiFsUtils.createDir('request-attachments');
    const key = `${Date.now()}${Math.ceil(Math.random() * 100)}`;
    const path = `${dir}/attachment_${key}.${file.extension}`;

    ApiFsUtils.saveFile(file.path, path);
    return { url: ApiFsUtils.pathToUrl(path) };
  }

  async updateStatus(
    user: JwtUserInfo,
    id: string,
    body: UpdateRequestStatusDto,
  ): Promise<{ success: boolean }> {
    const existing = await this.getById(id);
    await this.clergyMemberService.assertAuthorizedForChurch(user, existing.churchId);
    await this.requestRepo.update(id, { status: body.status as RequestStatus });
    return { success: true };
  }
}
