// ============================================================
// AMISACHE — region.service.ts
// Premier niveau modélisé sous Country.
// ============================================================
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Region } from '../entities/region.entity';
import { CountryService } from './country.service';
import { ApiErrorNotFoundById } from '../../utils/api-error';
import { CreateRegionDto, ListRegionQuery, UpdateRegionDto } from '../dto/region.dto';

@Injectable()
export class RegionService {
  constructor(
    @InjectRepository(Region) private readonly regionRepo: Repository<Region>,
    private readonly countryService: CountryService,
  ) {}

  async list(query: ListRegionQuery = {}): Promise<Region[]> {
    let qb = this.regionRepo.createQueryBuilder('r').orderBy('r.name', 'ASC');

    if (query.countryId?.trim()) {
      qb = qb.andWhere('r.countryId = :countryId', { countryId: query.countryId.trim() });
    }

    if (query.search?.trim()) {
      qb = qb.andWhere('r.name LIKE :term', { term: `%${query.search.trim()}%` });
    }

    return qb.getMany();
  }

  async getById(id: string): Promise<Region> {
    const region = await this.regionRepo.findOne({ where: { id } });
    if (!region) throw new ApiErrorNotFoundById('regions', id);
    return region;
  }

  async create(body: CreateRegionDto): Promise<Region> {
    await this.countryService.getById(body.countryId); // 404 propre si countryId invalide
    const region = this.regionRepo.create(body);
    return this.regionRepo.save(region);
  }

  async update(id: string, body: UpdateRegionDto): Promise<Region> {
    await this.getById(id);
    await this.regionRepo.update(id, body);
    return this.getById(id);
  }

  async delete(id: string): Promise<{ success: boolean }> {
    await this.getById(id);
    await this.regionRepo.delete(id);
    return { success: true };
  }
}
