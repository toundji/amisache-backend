// ============================================================
// AMISACHE — group.service.ts
// Groupes d'affinité d'une église.
// ============================================================
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Group } from '../entities/group.entity';
import { ChurchService } from '../../church/services/church.service';
import { ClergyMemberService } from '../../church/services/clergy-member.service';
import { ApiErrorNotFoundById } from '../../utils/api-error';
import { JwtUserInfo } from '../../auth/dto/auth.type.dto';
import { CreateGroupDto, ListGroupQuery, UpdateGroupDto } from '../dto/group.dto';

@Injectable()
export class GroupService {
  constructor(
    @InjectRepository(Group) private readonly groupRepo: Repository<Group>,
    private readonly churchService: ChurchService,
    private readonly clergyMemberService: ClergyMemberService,
  ) {}

  async list(query: ListGroupQuery): Promise<Group[]> {
    return this.groupRepo.find({
      where: { churchId: query.churchId },
      order: { name: 'ASC' },
    });
  }

  /** [Admin] Liste complète des groupes, toutes églises confondues. */
  async listAdmin(): Promise<Group[]> {
    return this.groupRepo.find({ order: { name: 'ASC' } });
  }

  /**
   * Liste complète des groupes d'UNE église — réservée au clergé ACTIF de
   * cette église (ou admin/engineer). 404 si l'église est inconnue.
   */
  async listForChurch(user: JwtUserInfo, churchId: string): Promise<Group[]> {
    await this.churchService.getById(churchId);
    await this.clergyMemberService.assertAuthorizedForChurch(user, churchId);
    return this.groupRepo.find({ where: { churchId }, order: { name: 'ASC' } });
  }

  async getById(id: string): Promise<Group> {
    const group = await this.groupRepo.findOne({ where: { id } });
    if (!group) throw new ApiErrorNotFoundById('groups', id);
    return group;
  }

  async create(user: JwtUserInfo, body: CreateGroupDto): Promise<Group> {
    await this.churchService.getById(body.churchId); // 404 propre si churchId invalide
    await this.clergyMemberService.assertAuthorizedForChurch(user, body.churchId);
    const group = this.groupRepo.create(body);
    return this.groupRepo.save(group);
  }

  async update(user: JwtUserInfo, id: string, body: UpdateGroupDto): Promise<Group> {
    const existing = await this.getById(id);
    await this.clergyMemberService.assertAuthorizedForChurch(user, existing.churchId);
    await this.groupRepo.update(id, body);
    return this.getById(id);
  }

  async delete(user: JwtUserInfo, id: string): Promise<{ success: boolean }> {
    const existing = await this.getById(id);
    await this.clergyMemberService.assertAuthorizedForChurch(user, existing.churchId);
    await this.groupRepo.delete(id);
    return { success: true };
  }
}
