// ============================================================
// AMISACHE — payment.service.ts
// Paiement déclaratif. `submit` est appelée par liturgy/ (Request et
// Donation créent leur Payment via ce service) — pas de création libre
// exposée : un paiement naît toujours attaché à une demande ou un don.
// ============================================================
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Payment } from '../entities/payment.entity';
import { PaymentStatus } from '../payment.enum';
import { PaymentMethodService } from './payment-method.service';
import { ClergyMemberService } from '../../church/services/clergy-member.service';
import { ApiError, ApiErrorNotFoundById } from '../../utils/api-error';
import { ApiFsUtils } from '../../utils/api-fs';
import { ImageDto } from '../../shared/media.dto';
import { SubmitPaymentDto } from '../dto/payment.dto';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment) private readonly paymentRepo: Repository<Payment>,
    private readonly paymentMethodService: PaymentMethodService,
    private readonly clergyMemberService: ClergyMemberService,
  ) {}

  async getById(id: string): Promise<Payment> {
    const payment = await this.paymentRepo.findOne({ where: { id } });
    if (!payment) throw new ApiErrorNotFoundById('payments', id);
    return payment;
  }

  /**
   * Crée le Payment (status SUBMITTED) référencé par un Request/Donation.
   * Réservée à liturgy/ — voir l'en-tête du fichier.
   *
   * `expectedChurchId`, quand fourni, vérifie que le moyen de paiement
   * appartient bien à CETTE église — évite qu'une demande/don pour la
   * paroisse A règle via le moyen de paiement de la paroisse B.
   */
  async submit(body: SubmitPaymentDto, expectedChurchId?: string): Promise<Payment> {
    const paymentMethod = await this.paymentMethodService.getById(body.paymentMethodId); // 404 propre si invalide
    if (expectedChurchId && paymentMethod.churchId !== expectedChurchId) {
      throw new ApiError("Ce moyen de paiement n'appartient pas à cette église.");
    }

    const payment = this.paymentRepo.create({
      amount: body.amount.toFixed(2),
      operator: body.operator,
      reference: body.reference,
      receiptImage: body.receiptImage,
      paidAt: body.paidAt,
      paymentMethodId: body.paymentMethodId,
    });
    return this.paymentRepo.save(payment);
  }

  /**
   * RÈGLE DURE (§7.6, test le plus important du projet — AMISACHE.md §10) :
   * seul un `ClergyMember` ACTIF de LA paroisse du paiement (déduite de
   * `paymentMethod.churchId`) peut confirmer/rejeter — jamais un `User`
   * quelconque, peu importe ses `UserRole` (même `admin`/`engineer`).
   */
  async confirmOrReject(
    id: string,
    callerUserId: string,
    status: PaymentStatus.CONFIRMED | PaymentStatus.REJECTED,
  ): Promise<Payment> {
    const payment = await this.paymentRepo.findOne({
      where: { id },
      relations: { paymentMethod: true },
    });
    if (!payment) throw new ApiErrorNotFoundById('payments', id);

    if (payment.status !== PaymentStatus.SUBMITTED) {
      throw new ApiError('Ce paiement a déjà été traité.');
    }

    const clergyMember = await this.clergyMemberService.findActiveForUserAndChurch(
      callerUserId,
      payment.paymentMethod!.churchId,
    );
    if (!clergyMember) {
      throw new ApiError(
        'Seul un membre du clergé de cette paroisse peut confirmer ce paiement.',
        { code: HttpStatus.FORBIDDEN },
      );
    }

    await this.paymentRepo.update(id, {
      status,
      confirmedAt: new Date(),
      confirmedById: clergyMember.id,
    });
    return this.getById(id);
  }

  /** Upload du reçu (image) avant soumission d'une Donation/Request avec paiement */
  async uploadReceiptImage(body: ImageDto): Promise<{ url: string }> {
    const image = body.image;
    const dir = ApiFsUtils.createDir('receipts');
    const key = `${Date.now()}${Math.ceil(Math.random() * 100)}`;
    const path = `${dir}/receipt_${key}.${image['fileType']['ext']}`;

    ApiFsUtils.saveFile(image.path, path);
    return { url: ApiFsUtils.pathToUrl(path) };
  }
}
