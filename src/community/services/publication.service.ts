// ============================================================
// AMISACHE — publication.service.ts
// Fil de contenu d'une église (annonces, événements, médias...).
// Voir cahier-des-charges §4.8.
// ============================================================
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Publication } from '../entities/publication.entity';
import { PublicationStatus } from '../community.enum';
import { ChurchService } from '../../church/services/church.service';
import { ClergyMemberService } from '../../church/services/clergy-member.service';
import { GroupService } from './group.service';
import { TypeService } from '../../type/services/type.service';
import { TypeScope } from '../../type/type.enum';
import { ApiError, ApiErrorNotFoundById } from '../../utils/api-error';
import { JwtUserInfo } from '../../auth/dto/auth.type.dto';
import {
  CreatePublicationDto,
  ListPublicationAdminQuery,
  ListPublicationPublicQuery,
  UpdatePublicationDto,
} from '../dto/publication.dto';

@Injectable()
export class PublicationService {
  constructor(
    @InjectRepository(Publication) private readonly pubRepo: Repository<Publication>,
    private readonly churchService: ChurchService,
    private readonly clergyMemberService: ClergyMemberService,
    private readonly groupService: GroupService,
    private readonly typeService: TypeService,
  ) {}

  /** Publiées, dans leur fenêtre d'affichage (startDate/endDate) si définie */
  async listPublic(query: ListPublicationPublicQuery): Promise<Publication[]> {
    const today = new Date().toISOString().slice(0, 10);

    let qb = this.pubRepo
      .createQueryBuilder('p')
      .where('p.status = :status', { status: PublicationStatus.PUBLISHED })
      .andWhere('(p.startDate IS NULL OR p.startDate <= :today)', { today })
      .andWhere('(p.endDate IS NULL OR p.endDate >= :today)', { today })
      .orderBy('p.publishedAt', 'DESC');

    if (query.churchId) qb = qb.andWhere('p.churchId = :churchId', { churchId: query.churchId });
    if (query.groupId) qb = qb.andWhere('p.groupId = :groupId', { groupId: query.groupId });

    return qb.getMany();
  }

  /**
   * [Admin] Liste complète (tous statuts, sans fenêtre d'affichage), toutes
   * églises. `churchId` reste accepté (déprécié — préférer
   * `GET /publications/church/:churchId`).
   */
  async listAdmin(query: ListPublicationAdminQuery = {}): Promise<Publication[]> {
    let qb = this.pubRepo.createQueryBuilder('p').orderBy('p.createdAt', 'DESC');

    if (query.churchId) qb = qb.andWhere('p.churchId = :churchId', { churchId: query.churchId });
    if (query.groupId) qb = qb.andWhere('p.groupId = :groupId', { groupId: query.groupId });
    if (query.status) qb = qb.andWhere('p.status = :status', { status: query.status });

    return qb.getMany();
  }

  /**
   * Liste complète des publications d'UNE église (tous statuts) — réservée
   * au clergé ACTIF de cette église (ou admin/engineer). 404 si l'église
   * est inconnue. Filtres `groupId` / `status` disponibles.
   */
  async listForChurch(
    user: JwtUserInfo,
    churchId: string,
    query: ListPublicationAdminQuery = {},
  ): Promise<Publication[]> {
    await this.churchService.getById(churchId);
    await this.clergyMemberService.assertAuthorizedForChurch(user, churchId);

    let qb = this.pubRepo
      .createQueryBuilder('p')
      .where('p.churchId = :churchId', { churchId })
      .orderBy('p.createdAt', 'DESC');

    if (query.groupId) qb = qb.andWhere('p.groupId = :groupId', { groupId: query.groupId });
    if (query.status) qb = qb.andWhere('p.status = :status', { status: query.status });

    return qb.getMany();
  }

  async getById(id: string): Promise<Publication> {
    const publication = await this.pubRepo.findOne({ where: { id } });
    if (!publication) throw new ApiErrorNotFoundById('publications', id);
    return publication;
  }

  /** 404 si absente ou non publiée — n'expose pas les brouillons/archives */
  async getPublicById(id: string): Promise<Publication> {
    const publication = await this.pubRepo.findOne({
      where: { id, status: PublicationStatus.PUBLISHED },
    });
    if (!publication) throw new ApiErrorNotFoundById('publications', id);
    return publication;
  }

  async create(user: JwtUserInfo, body: CreatePublicationDto): Promise<Publication> {
    await this.churchService.getById(body.churchId); // 404 propre si churchId invalide
    await this.clergyMemberService.assertAuthorizedForChurch(user, body.churchId);

    if (body.groupId) {
      const group = await this.groupService.getById(body.groupId);
      if (group.churchId !== body.churchId) {
        throw new ApiError("Ce groupe n'appartient pas à cette église.");
      }
    }

    await this.typeService.assertScope(body.typeId, TypeScope.PUBLICATION);

    const publication = this.pubRepo.create(body);
    return this.pubRepo.save(publication);
  }

  async update(user: JwtUserInfo, id: string, body: UpdatePublicationDto): Promise<Publication> {
    const existing = await this.getById(id);
    await this.clergyMemberService.assertAuthorizedForChurch(user, existing.churchId);
    await this.pubRepo.update(id, body);
    return this.getById(id);
  }

  /** `publishedAt` posé automatiquement au premier passage en PUBLISHED */
  async updateStatus(
    user: JwtUserInfo,
    id: string,
    status: PublicationStatus,
  ): Promise<Publication> {
    const publication = await this.getById(id);
    await this.clergyMemberService.assertAuthorizedForChurch(user, publication.churchId);
    const patch: Partial<Publication> = { status };
    if (status === PublicationStatus.PUBLISHED && !publication.publishedAt) {
      patch.publishedAt = new Date();
    }
    await this.pubRepo.update(id, patch);
    return this.getById(id);
  }

  async delete(user: JwtUserInfo, id: string): Promise<{ success: boolean }> {
    const existing = await this.getById(id);
    await this.clergyMemberService.assertAuthorizedForChurch(user, existing.churchId);
    await this.pubRepo.delete(id);
    return { success: true };
  }
}
