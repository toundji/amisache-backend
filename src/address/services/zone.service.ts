// ============================================================
// AMISACHE — zone.service.ts
// Deuxième niveau modélisé, sous Region. Ancrage obligatoire d'Address.
// ============================================================
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Zone } from '../entities/zone.entity';
import { RegionService } from './region.service';
import { ApiErrorNotFoundById } from '../../utils/api-error';
import { CreateZoneDto, ListZoneQuery, UpdateZoneDto } from '../dto/zone.dto';

@Injectable()
export class ZoneService {
  constructor(
    @InjectRepository(Zone) private readonly zoneRepo: Repository<Zone>,
    private readonly regionService: RegionService,
  ) {}

  async list(query: ListZoneQuery): Promise<Zone[]> {
    let qb = this.zoneRepo
      .createQueryBuilder('z')
      .where('z.regionId = :regionId', { regionId: query.regionId })
      .orderBy('z.name', 'ASC');

    if (query.search?.trim()) {
      qb = qb.andWhere('z.name LIKE :term', { term: `%${query.search.trim()}%` });
    }

    return qb.getMany();
  }

  async getById(id: string): Promise<Zone> {
    const zone = await this.zoneRepo.findOne({ where: { id } });
    if (!zone) throw new ApiErrorNotFoundById('zones', id);
    return zone;
  }

  async create(body: CreateZoneDto): Promise<Zone> {
    await this.regionService.getById(body.regionId); // 404 propre si regionId invalide
    const zone = this.zoneRepo.create(body);
    return this.zoneRepo.save(zone);
  }

  async update(id: string, body: UpdateZoneDto): Promise<Zone> {
    await this.getById(id);
    await this.zoneRepo.update(id, body);
    return this.getById(id);
  }

  async delete(id: string): Promise<{ success: boolean }> {
    await this.getById(id);
    await this.zoneRepo.delete(id);
    return { success: true };
  }
}
