// ============================================================
// AMISACHE — village.service.ts
// Troisième niveau modélisé, sous Zone. NON exhaustif — voir
// address.embeddable.ts et cahier-des-charges §4.1.
// ============================================================
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Village } from '../entities/village.entity';
import { ZoneService } from './zone.service';
import { ApiErrorNotFoundById } from '../../utils/api-error';
import { CreateVillageDto, ListVillageQuery, UpdateVillageDto } from '../dto/village.dto';

@Injectable()
export class VillageService {
  constructor(
    @InjectRepository(Village) private readonly villageRepo: Repository<Village>,
    private readonly zoneService: ZoneService,
  ) {}

  async list(query: ListVillageQuery): Promise<Village[]> {
    let qb = this.villageRepo
      .createQueryBuilder('v')
      .where('v.zoneId = :zoneId', { zoneId: query.zoneId })
      .orderBy('v.name', 'ASC');

    if (query.search?.trim()) {
      qb = qb.andWhere('v.name LIKE :term', { term: `%${query.search.trim()}%` });
    }

    return qb.getMany();
  }

  async getById(id: string): Promise<Village> {
    const village = await this.villageRepo.findOne({ where: { id } });
    if (!village) throw new ApiErrorNotFoundById('villages', id);
    return village;
  }

  async create(body: CreateVillageDto): Promise<Village> {
    await this.zoneService.getById(body.zoneId); // 404 propre si zoneId invalide
    const village = this.villageRepo.create(body);
    return this.villageRepo.save(village);
  }

  async update(id: string, body: UpdateVillageDto): Promise<Village> {
    await this.getById(id);
    await this.villageRepo.update(id, body);
    return this.getById(id);
  }

  async delete(id: string): Promise<{ success: boolean }> {
    await this.getById(id);
    await this.villageRepo.delete(id);
    return { success: true };
  }
}
