// ============================================================
// AMISACHE — entrance.service.ts
// Portes d'accès géolocalisées d'une Church.
// ============================================================
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Entrance } from '../entities/entrance.entity';
import { ChurchService } from './church.service';
import { ClergyMemberService } from './clergy-member.service';
import { ApiErrorNotFoundById } from '../../utils/api-error';
import { JwtUserInfo } from '../../auth/dto/auth.type.dto';
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
    private readonly clergyMemberService: ClergyMemberService,
  ) {}

  async list(query: ListEntranceQuery = {}): Promise<Entrance[]> {
    return this.entranceRepo.find({
      where: query.churchId ? { churchId: query.churchId } : {},
      relations: { church: true },
      order: { name: 'ASC' },
    });
  }

  /** [Admin] Liste complète, toutes églises confondues. */
  async listAdmin(): Promise<Entrance[]> {
    return this.list();
  }

  /**
   * Liste complète des entrées d'UNE église — réservée au clergé ACTIF de
   * cette église (ou admin/engineer). 404 si l'église est inconnue.
   */
  async listForChurch(user: JwtUserInfo, churchId: string): Promise<Entrance[]> {
    await this.churchService.getById(churchId);
    await this.clergyMemberService.assertAuthorizedForChurch(user, churchId);
    return this.list({ churchId });
  }

  async getById(id: string): Promise<Entrance> {
    const entrance = await this.entranceRepo.findOne({
      where: { id },
      relations: { church: true },
    });
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
