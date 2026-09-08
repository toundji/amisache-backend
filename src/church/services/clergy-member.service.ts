// ============================================================
// AMISACHE — clergy-member.service.ts
// Affectation clergé/personnel ↔ église. Les droits de back-office se
// dérivent de ces affectations (cahier-des-charges §3) — pas géré ici,
// juste le CRUD de la table qui les porte.
// ============================================================
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';

import { ClergyMember } from '../entities/clergy-member.entity';
import { ChurchService } from './church.service';
import { UserService } from '../../users/services/user.service';
import { ApiError, ApiErrorNotFoundById } from '../../utils/api-error';
import { JwtUserInfo } from '../../auth/dto/auth.type.dto';
import { UserRole } from '../../shared/common.enum';
import {
  CreateClergyMemberDto,
  ListClergyMemberQuery,
  UpdateClergyMemberDto,
} from '../dto/clergy-member.dto';

@Injectable()
export class ClergyMemberService {
  constructor(
    @InjectRepository(ClergyMember)
    private readonly clergyRepo: Repository<ClergyMember>,
    private readonly churchService: ChurchService,
    private readonly userService: UserService,
  ) {}

  async list(query: ListClergyMemberQuery = {}): Promise<ClergyMember[]> {
    return this.clergyRepo.find({
      where: {
        ...(query.churchId ? { churchId: query.churchId } : {}),
        ...(query.activeOnly ? { endDate: IsNull() } : {}),
      },
      relations: { user: true, church: true },
      order: { startDate: 'DESC' },
    });
  }

  /** [Admin] Liste complète, toutes églises confondues. */
  async listAdmin(query: ListClergyMemberQuery = {}): Promise<ClergyMember[]> {
    return this.list({ activeOnly: query.activeOnly });
  }

  /**
   * Liste complète des affectations d'UNE église — réservée au clergé
   * ACTIF de cette église (ou admin/engineer). 404 si l'église est inconnue,
   * 403 si l'appelant n'y est pas autorisé.
   */
  async listForChurch(
    user: JwtUserInfo,
    churchId: string,
    query: ListClergyMemberQuery = {},
  ): Promise<ClergyMember[]> {
    await this.churchService.getById(churchId);
    await this.assertAuthorizedForChurch(user, churchId);
    return this.list({ churchId, activeOnly: query.activeOnly });
  }

  async getById(id: string): Promise<ClergyMember> {
    const member = await this.clergyRepo.findOne({
      where: { id },
      relations: { user: true, church: true },
    });
    if (!member) throw new ApiErrorNotFoundById('clergy_members', id);
    return member;
  }

  async create(body: CreateClergyMemberDto): Promise<ClergyMember> {
    await this.churchService.getById(body.churchId); // 404 propre si churchId invalide
    await this.userService.getById(body.userId); // 404 propre si userId invalide

    const member = this.clergyRepo.create(body);
    return this.clergyRepo.save(member);
  }

  async update(id: string, body: UpdateClergyMemberDto): Promise<ClergyMember> {
    await this.getById(id);
    await this.clergyRepo.update(id, body);
    return this.getById(id);
  }

  async delete(id: string): Promise<{ success: boolean }> {
    await this.getById(id);
    await this.clergyRepo.delete(id);
    return { success: true };
  }

  /**
   * Résout l'affectation clergé ACTIVE d'un utilisateur pour une église
   * donnée, à la date du jour — `null` si aucune (l'utilisateur n'est
   * pas membre du clergé de cette église en ce moment).
   *
   * ⚠️ Base de la règle dure §7.6 : seul un `ClergyMember` de LA paroisse
   * concernée peut confirmer un paiement — jamais un `User` quelconque,
   * peu importe ses `UserRole`. Voir `PaymentService.confirm`.
   */
  async findActiveForUserAndChurch(
    userId: string,
    churchId: string,
  ): Promise<ClergyMember | null> {
    const today = new Date().toISOString().slice(0, 10);
    return this.clergyRepo.findOne({
      where: [
        { userId, churchId, endDate: IsNull(), startDate: LessThanOrEqual(today) },
        {
          userId,
          churchId,
          endDate: MoreThanOrEqual(today),
          startDate: LessThanOrEqual(today),
        },
      ],
    });
  }

  /**
   * Autorise une écriture sur une ressource rattachée à UNE église : les
   * rôles plateforme (`admin`/`engineer`) passent toujours ; sinon
   * l'appelant doit être un `ClergyMember` ACTIF de CETTE église précise.
   *
   * ⚠️ Ne jamais remplacer par un simple test de `UserRole.clergy` — ce
   * rôle est un marqueur plateforme grossier, sans portée par église
   * (AMISACHE.md §5). C'est cette méthode qui porte l'isolation
   * multi-tenant pour les routes CRUD ouvertes au clergé (Schedule,
   * PaymentMethod, Group, Publication...). Distincte de la règle encore
   * plus stricte de `PaymentService.confirmOrReject` (§7.6), qui n'a
   * aucun bypass admin/engineer.
   */
  async assertAuthorizedForChurch(user: JwtUserInfo, churchId: string): Promise<void> {
    if (user.roles.includes(UserRole.admin) || user.roles.includes(UserRole.engineer)) {
      return;
    }

    const clergyMember = await this.findActiveForUserAndChurch(user.id, churchId);
    if (!clergyMember) {
      throw new ApiError(
        'Seul un membre du clergé actif de cette église peut effectuer cette action.',
        { code: HttpStatus.FORBIDDEN },
      );
    }
  }
}
