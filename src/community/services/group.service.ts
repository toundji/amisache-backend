// ============================================================
// AMISACHE — group.service.ts
// Groupes d'affinité d'une église.
// ============================================================
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Group } from '../entities/group.entity';
import { ChurchService } from '../../church/services/church.service';
import { ApiErrorNotFoundById } from '../../utils/api-error';
import { CreateGroupDto, ListGroupQuery, UpdateGroupDto } from '../dto/group.dto';

@Injectable()
export class GroupService {
  constructor(
    @InjectRepository(Group) private readonly groupRepo: Repository<Group>,
    private readonly churchService: ChurchService,
  ) {}

  async list(query: ListGroupQuery): Promise<Group[]> {
    return this.groupRepo.find({
      where: { churchId: query.churchId },
      order: { name: 'ASC' },
    });
  }

  async getById(id: string): Promise<Group> {
    const group = await this.groupRepo.findOne({ where: { id } });
    if (!group) throw new ApiErrorNotFoundById('groups', id);
    return group;
  }

  async create(body: CreateGroupDto): Promise<Group> {
    await this.churchService.getById(body.churchId); // 404 propre si churchId invalide
    const group = this.groupRepo.create(body);
    return this.groupRepo.save(group);
  }

  async update(id: string, body: UpdateGroupDto): Promise<Group> {
    await this.getById(id);
    await this.groupRepo.update(id, body);
    return this.getById(id);
  }

  async delete(id: string): Promise<{ success: boolean }> {
    await this.getById(id);
    await this.groupRepo.delete(id);
    return { success: true };
  }
}
