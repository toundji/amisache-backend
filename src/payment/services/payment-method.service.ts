// ============================================================
// AMISACHE — payment-method.service.ts
// Coordonnées d'encaissement publiées par une église.
// ============================================================
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PaymentMethod } from '../entities/payment-method.entity';
import { ChurchService } from '../../church/services/church.service';
import { ClergyMemberService } from '../../church/services/clergy-member.service';
import { ApiErrorNotFoundById } from '../../utils/api-error';
import { JwtUserInfo } from '../../auth/dto/auth.type.dto';
import {
  CreatePaymentMethodDto,
  ListPaymentMethodQuery,
  UpdatePaymentMethodDto,
} from '../dto/payment-method.dto';

@Injectable()
export class PaymentMethodService {
  constructor(
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepo: Repository<PaymentMethod>,
    private readonly churchService: ChurchService,
    private readonly clergyMemberService: ClergyMemberService,
  ) {}

  async list(query: ListPaymentMethodQuery): Promise<PaymentMethod[]> {
    return this.paymentMethodRepo.find({
      where: {
        churchId: query.churchId,
        ...(query.activeOnly === false ? {} : { active: true }),
      },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * [Admin] Liste complète des moyens de paiement, toutes églises. Renvoie
   * aussi les moyens désactivés ; `activeOnly=true` filtre sur les actifs.
   */
  async listAdmin(query: ListPaymentMethodQuery = {}): Promise<PaymentMethod[]> {
    return this.paymentMethodRepo.find({
      where: String(query.activeOnly) === 'true' ? { active: true } : {},
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Liste complète des moyens de paiement d'UNE église — réservée au clergé
   * ACTIF de cette église (ou admin/engineer). 404 si l'église est inconnue.
   */
  async listForChurch(
    user: JwtUserInfo,
    churchId: string,
    query: ListPaymentMethodQuery = {},
  ): Promise<PaymentMethod[]> {
    await this.churchService.getById(churchId);
    await this.clergyMemberService.assertAuthorizedForChurch(user, churchId);
    return this.paymentMethodRepo.find({
      where: {
        churchId,
        ...(String(query.activeOnly) === 'true' ? { active: true } : {}),
      },
      order: { createdAt: 'ASC' },
    });
  }

  async getById(id: string): Promise<PaymentMethod> {
    const method = await this.paymentMethodRepo.findOne({ where: { id } });
    if (!method) throw new ApiErrorNotFoundById('payment_methods', id);
    return method;
  }

  async create(user: JwtUserInfo, body: CreatePaymentMethodDto): Promise<PaymentMethod> {
    await this.churchService.getById(body.churchId); // 404 propre si churchId invalide
    await this.clergyMemberService.assertAuthorizedForChurch(user, body.churchId);
    const method = this.paymentMethodRepo.create(body);
    return this.paymentMethodRepo.save(method);
  }

  async update(
    user: JwtUserInfo,
    id: string,
    body: UpdatePaymentMethodDto,
  ): Promise<PaymentMethod> {
    const existing = await this.getById(id);
    await this.clergyMemberService.assertAuthorizedForChurch(user, existing.churchId);
    await this.paymentMethodRepo.update(id, body);
    return this.getById(id);
  }

  async delete(user: JwtUserInfo, id: string): Promise<{ success: boolean }> {
    const existing = await this.getById(id);
    await this.clergyMemberService.assertAuthorizedForChurch(user, existing.churchId);
    await this.paymentMethodRepo.delete(id);
    return { success: true };
  }
}
