// ============================================================
// AMISACHE — membership.service.ts
// Paroisses suivies par un fidèle (Membership) + invariante
// homeChurchId ∈ Membership(user) — voir AMISACHE.md §5.
// ============================================================
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Membership } from '../entities/membership.entity';
import { ChurchService } from './church.service';
import { ClergyMemberService } from './clergy-member.service';
import { UserService } from '../../users/services/user.service';
import { ApiError, ApiErrorNotFoundById } from '../../utils/api-error';
import { JwtUserInfo } from '../../auth/dto/auth.type.dto';

@Injectable()
export class MembershipService {
  constructor(
    @InjectRepository(Membership)
    private readonly membershipRepo: Repository<Membership>,
    private readonly churchService: ChurchService,
    private readonly clergyMemberService: ClergyMemberService,
    private readonly userService: UserService,
  ) {}

  async listMine(userId: string): Promise<Membership[]> {
    return this.membershipRepo.find({
      where: { userId },
      relations: { church: true },
      order: { since: 'DESC' },
    });
  }

  /** [Admin] Liste complète des abonnements, toutes églises confondues. */
  async listAdmin(): Promise<Membership[]> {
    return this.membershipRepo.find({
      relations: { user: true, church: true },
      order: { since: 'DESC' },
    });
  }

  /**
   * Liste complète des abonnés d'UNE église — réservée au clergé ACTIF de
   * cette église (ou admin/engineer). 404 si l'église est inconnue.
   */
  async listForChurch(user: JwtUserInfo, churchId: string): Promise<Membership[]> {
    await this.churchService.getById(churchId);
    await this.clergyMemberService.assertAuthorizedForChurch(user, churchId);
    return this.membershipRepo.find({
      where: { churchId },
      relations: { user: true, church: true },
      order: { since: 'DESC' },
    });
  }

  async getById(id: string): Promise<Membership> {
    const membership = await this.membershipRepo.findOne({ where: { id } });
    if (!membership) throw new ApiErrorNotFoundById('memberships', id);
    return membership;
  }

  async follow(userId: string, churchId: string): Promise<Membership> {
    await this.churchService.getById(churchId); // 404 propre si churchId invalide

    const existing = await this.membershipRepo.findOne({
      where: { userId, churchId },
    });
    if (existing) {
      throw new ApiError('Cette paroisse est déjà suivie.');
    }

    const membership = this.membershipRepo.create({ userId, churchId });
    return this.membershipRepo.save(membership);
  }

  async unfollow(
    id: string,
    requesterId: string,
    isAdmin: boolean,
  ): Promise<{ success: boolean }> {
    const membership = await this.getById(id);
    if (!isAdmin && membership.userId !== requesterId) {
      throw new ApiError('Vous ne pouvez retirer que vos propres abonnements.', {
        code: HttpStatus.FORBIDDEN,
      });
    }
    await this.membershipRepo.delete(id);
    return { success: true };
  }

  /**
   * Définit la paroisse de référence du fidèle — refuse si `churchId`
   * n'est pas (encore) une des paroisses suivies (invariante §5).
   */
  async setHomeChurch(
    userId: string,
    churchId: string,
  ): Promise<{ success: boolean }> {
    const membership = await this.membershipRepo.findOne({
      where: { userId, churchId },
    });
    if (!membership) {
      throw new ApiError(
        'Vous devez suivre cette paroisse avant de la définir comme référence.',
      );
    }
    return this.userService.updateHomeChurch(userId, churchId);
  }
}
