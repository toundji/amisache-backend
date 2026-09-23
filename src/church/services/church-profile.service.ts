// ============================================================
// AMISACHE — church-profile.service.ts
// Contenu de présentation d'une église (voir church-profile.entity.ts pour
// le pourquoi d'une table séparée). Un seul profil par église, upsert.
// ============================================================
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ChurchProfile } from '../entities/church-profile.entity';
import { ChurchService } from './church.service';
import { ClergyMemberService } from './clergy-member.service';
import { JwtUserInfo } from '../../auth/dto/auth.type.dto';
import { UpsertChurchProfileDto } from '../dto/church-profile.dto';

@Injectable()
export class ChurchProfileService {
  constructor(
    @InjectRepository(ChurchProfile)
    private readonly churchProfileRepo: Repository<ChurchProfile>,
    private readonly churchService: ChurchService,
    private readonly clergyMemberService: ClergyMemberService,
  ) {}

  /** GET /church-profiles/church/:churchId — public. `null` si aucun profil publié. */
  async getForChurch(churchId: string): Promise<ChurchProfile | null> {
    return this.churchProfileRepo.findOne({ where: { churchId } });
  }

  /**
   * PATCH /church-profiles/church/:churchId — admin/engineer, ou clergé ACTIF
   * de cette église. Crée le profil au premier appel, le met à jour ensuite.
   */
  async upsertForChurch(
    user: JwtUserInfo,
    churchId: string,
    body: UpsertChurchProfileDto,
  ): Promise<ChurchProfile> {
    await this.churchService.getById(churchId); // 404 propre si churchId invalide
    await this.clergyMemberService.assertAuthorizedForChurch(user, churchId);

    const existing = await this.churchProfileRepo.findOne({ where: { churchId } });
    if (existing) {
      await this.churchProfileRepo.update(existing.id, body);
      return (await this.churchProfileRepo.findOne({ where: { id: existing.id } }))!;
    }

    const profile = this.churchProfileRepo.create({ ...body, churchId });
    return this.churchProfileRepo.save(profile);
  }
}
