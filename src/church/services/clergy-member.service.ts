// ============================================================
// AMISACHE — clergy-member.service.ts
// Affectation clergé/personnel ↔ église. Les droits de back-office se
// dérivent de ces affectations (cahier-des-charges §3) — pas géré ici,
// juste le CRUD de la table qui les porte.
// ============================================================
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';

import { ClergyMember } from '../entities/clergy-member.entity';
import { ChurchService } from './church.service';
import { UserService } from '../../users/services/user.service';
import { ApiErrorNotFoundById } from '../../utils/api-error';
import {
  CreateClergyMemberDto,
  ListClergyMemberQuery,
  UpdateClergyMemberDto,
} from '../dto/clergy-member.dto';

@Injectable()
export class ClergyMemberService {
  constructor(
    @InjectRepository(ClergyMember)
    private readonly clergyRepo: Repository<ClergyMember>,
    private readonly churchService: ChurchService,
    private readonly userService: UserService,
  ) {}

  async list(query: ListClergyMemberQuery): Promise<ClergyMember[]> {
    return this.clergyRepo.find({
      where: {
        churchId: query.churchId,
        ...(query.activeOnly ? { endDate: IsNull() } : {}),
      },
      relations: { user: true },
      order: { startDate: 'DESC' },
    });
  }

  async getById(id: string): Promise<ClergyMember> {
    const member = await this.clergyRepo.findOne({
      where: { id },
      relations: { user: true },
    });
    if (!member) throw new ApiErrorNotFoundById('clergy_members', id);
    return member;
  }

  async create(body: CreateClergyMemberDto): Promise<ClergyMember> {
    await this.churchService.getById(body.churchId); // 404 propre si churchId invalide
    await this.userService.getById(body.userId); // 404 propre si userId invalide

    const member = this.clergyRepo.create(body);
    return this.clergyRepo.save(member);
  }

  async update(id: string, body: UpdateClergyMemberDto): Promise<ClergyMember> {
    await this.getById(id);
    await this.clergyRepo.update(id, body);
    return this.getById(id);
  }

  async delete(id: string): Promise<{ success: boolean }> {
    await this.getById(id);
    await this.clergyRepo.delete(id);
    return { success: true };
  }

  /**
   * Résout l'affectation clergé ACTIVE d'un utilisateur pour une église
   * donnée, à la date du jour — `null` si aucune (l'utilisateur n'est
   * pas membre du clergé de cette église en ce moment).
   *
   * ⚠️ Base de la règle dure §7.6 : seul un `ClergyMember` de LA paroisse
   * concernée peut confirmer un paiement — jamais un `User` quelconque,
   * peu importe ses `UserRole`. Voir `PaymentService.confirm`.
   */
  async findActiveForUserAndChurch(
    userId: string,
    churchId: string,
  ): Promise<ClergyMember | null> {
    const today = new Date().toISOString().slice(0, 10);
    return this.clergyRepo.findOne({
      where: [
        { userId, churchId, endDate: IsNull(), startDate: LessThanOrEqual(today) },
        {
          userId,
          churchId,
          endDate: MoreThanOrEqual(today),
          startDate: LessThanOrEqual(today),
        },
      ],
    });
  }
}
