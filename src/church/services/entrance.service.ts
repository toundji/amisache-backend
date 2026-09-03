// ============================================================
// AMISACHE — entrance.service.ts
// Portes d'accès géolocalisées d'une Church.
// ============================================================
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Entrance } from '../entities/entrance.entity';
import { ChurchService } from './church.service';
import { ApiErrorNotFoundById } from '../../utils/api-error';
import type { Point } from '../../shared/geo';
import {
  CreateEntranceDto,
  ListEntranceQuery,
  UpdateEntranceDto,
} from '../dto/entrance.dto';

function toPoint(location: { lat: number; lng: number }): Point {
  return { type: 'Point', coordinates: [location.lng, location.lat] };
}

@Injectable()
export class EntranceService {
  constructor(
    @InjectRepository(Entrance) private readonly entranceRepo: Repository<Entrance>,
    private readonly churchService: ChurchService,
  ) {}

  async list(query: ListEntranceQuery): Promise<Entrance[]> {
    return this.entranceRepo.find({
      where: { churchId: query.churchId },
      order: { name: 'ASC' },
    });
  }

  async getById(id: string): Promise<Entrance> {
    const entrance = await this.entranceRepo.findOne({ where: { id } });
    if (!entrance) throw new ApiErrorNotFoundById('entrances', id);
    return entrance;
  }

  async create(body: CreateEntranceDto): Promise<Entrance> {
    await this.churchService.getById(body.churchId); // 404 propre si churchId invalide

    const entrance = this.entranceRepo.create({
      type: body.type,
      name: body.name,
      churchId: body.churchId,
      location: toPoint(body.location),
    });
    return this.entranceRepo.save(entrance);
  }

  async update(id: string, body: UpdateEntranceDto): Promise<Entrance> {
    await this.getById(id);

    const { location, ...rest } = body;
    const patch: Partial<Entrance> = { ...rest };
    if (location) patch.location = toPoint(location);

    await this.entranceRepo.update(id, patch);
    return this.getById(id);
  }

  async delete(id: string): Promise<{ success: boolean }> {
    await this.getById(id);
    await this.entranceRepo.delete(id);
    return { success: true };
  }
}
