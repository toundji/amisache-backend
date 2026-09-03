// ============================================================
// AMISACHE — group-member.service.ts
// Adhésion des fidèles à un groupe.
// ============================================================
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { GroupMember } from '../entities/group-member.entity';
import { GroupService } from './group.service';
import { ApiError, ApiErrorNotFoundById } from '../../utils/api-error';

@Injectable()
export class GroupMemberService {
  constructor(
    @InjectRepository(GroupMember)
    private readonly memberRepo: Repository<GroupMember>,
    private readonly groupService: GroupService,
  ) {}

  async listMine(userId: string): Promise<GroupMember[]> {
    return this.memberRepo.find({
      where: { userId },
      relations: { group: true },
      order: { createdAt: 'DESC' },
    });
  }

  /** [Admin] Membres d'un groupe donné */
  async listForGroup(groupId: string): Promise<GroupMember[]> {
    return this.memberRepo.find({
      where: { groupId },
      relations: { user: true },
      order: { createdAt: 'ASC' },
    });
  }

  async join(userId: string, groupId: string): Promise<GroupMember> {
    await this.groupService.getById(groupId); // 404 propre si groupId invalide

    const existing = await this.memberRepo.findOne({ where: { userId, groupId } });
    if (existing) {
      throw new ApiError('Vous êtes déjà membre de ce groupe.');
    }

    const member = this.memberRepo.create({ userId, groupId });
    return this.memberRepo.save(member);
  }

  async leave(
    id: string,
    requesterId: string,
    isAdmin: boolean,
  ): Promise<{ success: boolean }> {
    const member = await this.memberRepo.findOne({ where: { id } });
    if (!member) throw new ApiErrorNotFoundById('group_members', id);

    if (!isAdmin && member.userId !== requesterId) {
      throw new ApiError('Vous ne pouvez retirer que votre propre adhésion.', {
        code: HttpStatus.FORBIDDEN,
      });
    }

    await this.memberRepo.delete(id);
    return { success: true };
  }
}
