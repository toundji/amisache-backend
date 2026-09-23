// ============================================================
// AMISACHE — tariff.service.ts
// Tarifs d'intention/sacrement par église, avec repli hiérarchique — voir
// tariff.entity.ts.
// ============================================================
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Tariff } from '../entities/tariff.entity';
import { ChurchService } from '../../church/services/church.service';
import { ClergyMemberService } from '../../church/services/clergy-member.service';
import { TypeService } from '../../type/services/type.service';
import { TypeScope } from '../../type/type.enum';
import { ApiError, ApiErrorNotFoundById } from '../../utils/api-error';
import { JwtUserInfo } from '../../auth/dto/auth.type.dto';
import { CreateTariffDto, ListTariffQuery, ResolvedTariff, UpdateTariffDto } from '../dto/tariff.dto';

// Garde-fou contre un cycle de hiérarchie qui existerait malgré la
// validation déjà faite par ChurchService (rang parent strictement
// supérieur) — la hiérarchie réelle ne dépasse jamais 5 niveaux
// (conférence → archidiocèse/diocèse → doyenné → paroisse → église/chapelle).
const MAX_RESOLUTION_HOPS = 15;

@Injectable()
export class TariffService {
  constructor(
    @InjectRepository(Tariff) private readonly tariffRepo: Repository<Tariff>,
    private readonly churchService: ChurchService,
    private readonly clergyMemberService: ClergyMemberService,
    private readonly typeService: TypeService,
  ) {}

  /**
   * Tarif applicable pour (churchId, typeId) — celui de l'église elle-même
   * s'il existe, sinon celui de la première église ancêtre qui en a un
   * (`Church.parentId`, en remontant). `null` si aucun tarif n'est configuré
   * nulle part dans la hiérarchie — le montant reste alors libre (cf.
   * `/demandes`, formulaire de paiement).
   */
  async resolve(churchId: string, typeId: string): Promise<ResolvedTariff | null> {
    let currentId: string | undefined = churchId;

    for (let hop = 0; currentId && hop < MAX_RESOLUTION_HOPS; hop++) {
      const tariff = await this.tariffRepo.findOne({ where: { churchId: currentId, typeId, active: true } });
      if (tariff) {
        const church = await this.churchService.getById(currentId);
        return { amount: Number(tariff.amount), definedByChurchId: currentId, definedByChurchName: church.name };
      }

      const church = await this.churchService.getById(currentId);
      currentId = church.parentId;
    }

    return null;
  }

  /**
   * Liste complète des tarifs propres à UNE église (pas la résolution avec
   * repli — les tarifs réellement définis ici) — réservée au clergé ACTIF de
   * cette église (ou admin/engineer). 404 si l'église est inconnue.
   */
  async listForChurch(user: JwtUserInfo, churchId: string): Promise<Tariff[]> {
    await this.churchService.getById(churchId);
    await this.clergyMemberService.assertAuthorizedForChurch(user, churchId);
    return this.tariffRepo.find({ where: { churchId }, order: { createdAt: 'ASC' } });
  }

  /** [Admin] Liste complète des tarifs, toutes églises. */
  async listAdmin(query: ListTariffQuery = {}): Promise<Tariff[]> {
    return this.tariffRepo.find({
      where: query.churchId ? { churchId: query.churchId } : {},
      order: { createdAt: 'ASC' },
    });
  }

  async getById(id: string): Promise<Tariff> {
    const tariff = await this.tariffRepo.findOne({ where: { id } });
    if (!tariff) throw new ApiErrorNotFoundById('tariffs', id);
    return tariff;
  }

  /** GET /tariffs/:id pour un compte non admin/engineer : clergé ACTIF de l'église de ce tarif. */
  async getByIdForClergy(id: string, user: JwtUserInfo): Promise<Tariff> {
    const tariff = await this.getById(id);
    await this.clergyMemberService.assertAuthorizedForChurch(user, tariff.churchId);
    return tariff;
  }

  async create(user: JwtUserInfo, body: CreateTariffDto): Promise<Tariff> {
    await this.churchService.getById(body.churchId); // 404 propre si churchId invalide
    await this.clergyMemberService.assertAuthorizedForChurch(user, body.churchId);
    await this.typeService.assertScope(body.typeId, [TypeScope.INTENTION, TypeScope.SACRAMENT]);

    const existing = await this.tariffRepo.findOne({ where: { churchId: body.churchId, typeId: body.typeId } });
    if (existing) {
      throw new ApiError('Un tarif existe déjà pour ce type dans cette église — modifiez-le plutôt.');
    }

    const tariff = this.tariffRepo.create({ ...body, amount: body.amount.toFixed(2) });
    return this.tariffRepo.save(tariff);
  }

  async update(user: JwtUserInfo, id: string, body: UpdateTariffDto): Promise<Tariff> {
    const existing = await this.getById(id);
    await this.clergyMemberService.assertAuthorizedForChurch(user, existing.churchId);
    await this.tariffRepo.update(id, {
      ...(body.amount !== undefined ? { amount: body.amount.toFixed(2) } : {}),
      ...(body.active !== undefined ? { active: body.active } : {}),
    });
    return this.getById(id);
  }

  async delete(user: JwtUserInfo, id: string): Promise<{ success: boolean }> {
    const existing = await this.getById(id);
    await this.clergyMemberService.assertAuthorizedForChurch(user, existing.churchId);
    await this.tariffRepo.delete(id);
    return { success: true };
  }
}
