// ============================================================
// AMISACHE — payment-method.service.ts
// Coordonnées d'encaissement publiées par une église.
// ============================================================
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PaymentMethod } from '../entities/payment-method.entity';
import { ChurchService } from '../../church/services/church.service';
import { ApiErrorNotFoundById } from '../../utils/api-error';
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

  async getById(id: string): Promise<PaymentMethod> {
    const method = await this.paymentMethodRepo.findOne({ where: { id } });
    if (!method) throw new ApiErrorNotFoundById('payment_methods', id);
    return method;
  }

  async create(body: CreatePaymentMethodDto): Promise<PaymentMethod> {
    await this.churchService.getById(body.churchId); // 404 propre si churchId invalide
    const method = this.paymentMethodRepo.create(body);
    return this.paymentMethodRepo.save(method);
  }

  async update(id: string, body: UpdatePaymentMethodDto): Promise<PaymentMethod> {
    await this.getById(id);
    await this.paymentMethodRepo.update(id, body);
    return this.getById(id);
  }

  async delete(id: string): Promise<{ success: boolean }> {
    await this.getById(id);
    await this.paymentMethodRepo.delete(id);
    return { success: true };
  }
}
