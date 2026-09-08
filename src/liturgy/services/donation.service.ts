// ============================================================
// AMISACHE — donation.service.ts
// Don du fidèle. Paiement TOUJOURS requis à la création — voir
// donation.entity.ts et cahier-des-charges §4.7.
// ============================================================
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Donation } from '../entities/donation.entity';
import { ChurchService } from '../../church/services/church.service';
import { ClergyMemberService } from '../../church/services/clergy-member.service';
import { TypeService } from '../../type/services/type.service';
import { TypeScope } from '../../type/type.enum';
import { PaymentService } from '../../payment/services/payment.service';
import { ApiErrorNotFoundById } from '../../utils/api-error';
import { JwtUserInfo } from '../../auth/dto/auth.type.dto';
import { CreateDonationDto, ListDonationQuery } from '../dto/donation.dto';

@Injectable()
export class DonationService {
  constructor(
    @InjectRepository(Donation) private readonly donationRepo: Repository<Donation>,
    private readonly churchService: ChurchService,
    private readonly clergyMemberService: ClergyMemberService,
    private readonly typeService: TypeService,
    private readonly paymentService: PaymentService,
  ) {}

  async listMine(userId: string): Promise<Donation[]> {
    return this.donationRepo.find({ where: { userId }, order: { date: 'DESC' } });
  }

  /**
   * [Admin] Liste complète des dons, toutes églises. `churchId` reste
   * accepté (déprécié — préférer `GET /donations/church/:churchId`).
   */
  async listAdmin(query: ListDonationQuery = {}): Promise<Donation[]> {
    return this.donationRepo.find({
      where: query.churchId ? { churchId: query.churchId } : {},
      order: { date: 'DESC' },
    });
  }

  /**
   * Liste complète des dons d'UNE église — réservée au clergé ACTIF de
   * cette église (ou admin/engineer). 404 si l'église est inconnue.
   */
  async listForChurch(user: JwtUserInfo, churchId: string): Promise<Donation[]> {
    await this.churchService.getById(churchId);
    await this.clergyMemberService.assertAuthorizedForChurch(user, churchId);
    return this.donationRepo.find({
      where: { churchId },
      order: { date: 'DESC' },
    });
  }

  /** Lecture par id — réservée au donateur lui-même (l'admin passe par getById) */
  async getMineById(id: string, userId: string): Promise<Donation> {
    const donation = await this.getById(id);
    if (donation.userId !== userId) {
      throw new ApiErrorNotFoundById('donations', id); // 404, pas 403 — n'expose pas l'existence
    }
    return donation;
  }

  async getById(id: string): Promise<Donation> {
    const donation = await this.donationRepo.findOne({ where: { id } });
    if (!donation) throw new ApiErrorNotFoundById('donations', id);
    return donation;
  }

  async create(userId: string, body: CreateDonationDto): Promise<Donation> {
    await this.churchService.getById(body.churchId); // 404 propre si churchId invalide
    await this.typeService.assertScope(body.typeId, TypeScope.DONATION);

    const payment = await this.paymentService.submit(body.payment, body.churchId);

    const donation = this.donationRepo.create({
      amount: body.payment.amount.toFixed(2),
      date: new Date(),
      churchId: body.churchId,
      userId,
      typeId: body.typeId,
      paymentId: payment.id,
    });
    return this.donationRepo.save(donation);
  }
}
