// ============================================================
// AMISACHE — tariff.service.ts
// Tarifs d'intention/sacrement par église, avec repli hiérarchique — voir
// tariff.entity.ts.
// ============================================================
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';

import { Tariff } from '../entities/tariff.entity';
import { ChurchService } from '../../church/services/church.service';
import { ClergyMemberService } from '../../church/services/clergy-member.service';
import { RequestTypeService } from './request-type.service';
import { RequestType } from '../entities/request-type.entity';
import { ApiError, ApiErrorNotFoundById } from '../../utils/api-error';
import { JwtUserInfo } from '../../auth/dto/auth.type.dto';
import {
  CreateTariffDto,
  ListTariffQuery,
  ResolvedMinLeadDays,
  ResolvedTariff,
  UpdateTariffDto,
} from '../dto/tariff.dto';

// Garde-fou contre un cycle de hiérarchie qui existerait malgré la
// validation déjà faite par ChurchService (rang parent strictement
// supérieur) — la hiérarchie réelle ne dépasse jamais 5 niveaux
// (conférence → archidiocèse/diocèse → vicariat → paroisse → église/chapelle).
const MAX_RESOLUTION_HOPS = 15;

@Injectable()
export class TariffService {
  constructor(
    @InjectRepository(Tariff) private readonly tariffRepo: Repository<Tariff>,
    private readonly churchService: ChurchService,
    private readonly clergyMemberService: ClergyMemberService,
    private readonly requestTypeService: RequestTypeService,
  ) {}

  /**
   * Tarif applicable pour (churchId, typeId) — celui de l'église elle-même
   * s'il existe, sinon celui de la première église ancêtre qui en a un
   * (`Church.parentId`, en remontant). `null` si aucun tarif n'est configuré
   * nulle part dans la hiérarchie — le montant reste alors libre (cf.
   * `/demandes`, formulaire de paiement).
   */
  async resolve(churchId: string, typeId: string): Promise<ResolvedTariff | null> {
    const found = await this.findInHierarchy(churchId, typeId, 'amount');
    if (!found) return null;
    return {
      amount: Number(found.tariff.amount),
      definedByChurchId: found.church.id,
      definedByChurchName: found.church.name,
    };
  }

  /**
   * Délai minimum applicable pour (churchId, type) — même repli que
   * `resolve`, mais indépendant du montant (l'offrande peut venir du
   * diocèse et le délai de la paroisse). Aucun délai dans la hiérarchie →
   * `RequestType.minLeadDays`, la valeur par défaut de la plateforme.
   */
  async resolveMinLeadDays(churchId: string, type: RequestType): Promise<ResolvedMinLeadDays> {
    const found = await this.findInHierarchy(churchId, type.id, 'minLeadDays');
    return found
      ? {
          minLeadDays: found.tariff.minLeadDays!,
          definedByChurchId: found.church.id,
          definedByChurchName: found.church.name,
        }
      : { minLeadDays: type.minLeadDays, definedByChurchId: null, definedByChurchName: null };
  }

  /** GET /tariffs/min-lead-days — vérifie le type avant de résoudre. */
  async resolveMinLeadDaysById(churchId: string, typeId: string): Promise<ResolvedMinLeadDays> {
    await this.churchService.getById(churchId); // 404 propre si churchId invalide
    const type = await this.requestTypeService.getById(typeId); // 404 propre si typeId invalide
    return this.resolveMinLeadDays(churchId, type);
  }

  /**
   * Premier tarif actif définissant `field` pour ce type, sur l'église puis
   * ses ancêtres (`Church.parentId`, en remontant).
   */
  private async findInHierarchy(churchId: string, typeId: string, field: 'amount' | 'minLeadDays') {
    let currentId: string | undefined = churchId;

    for (let hop = 0; currentId && hop < MAX_RESOLUTION_HOPS; hop++) {
      const tariff = await this.tariffRepo.findOne({
        where: { churchId: currentId, typeId, active: true, [field]: Not(IsNull()) },
      });
      const church = await this.churchService.getById(currentId);
      if (tariff) return { tariff, church };
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
    await this.requestTypeService.getById(body.typeId); // 404 propre si typeId invalide

    const existing = await this.tariffRepo.findOne({ where: { churchId: body.churchId, typeId: body.typeId } });
    if (existing) {
      throw new ApiError('Un tarif existe déjà pour ce type dans cette église — modifiez-le plutôt.');
    }

    if (body.amount == null && body.minLeadDays == null) {
      throw new ApiError('Indiquez au moins un montant ou un délai minimum.');
    }

    const tariff = this.tariffRepo.create({
      church: { id: body.churchId } as any,
      type: { id: body.typeId } as any,
      amount: body.amount != null ? body.amount.toFixed(2) : null,
      minLeadDays: body.minLeadDays ?? null,
    });
    return this.tariffRepo.save(tariff);
  }

  async update(user: JwtUserInfo, id: string, body: UpdateTariffDto): Promise<Tariff> {
    const existing = await this.getById(id);
    await this.clergyMemberService.assertAuthorizedForChurch(user, existing.churchId);
    const amount = body.amount !== undefined ? (body.amount?.toFixed(2) ?? null) : existing.amount;
    const minLeadDays = body.minLeadDays !== undefined ? body.minLeadDays : existing.minLeadDays;
    if (amount == null && minLeadDays == null) {
      throw new ApiError('Indiquez au moins un montant ou un délai minimum — ou supprimez ce tarif.');
    }

    await this.tariffRepo.update(id, {
      amount,
      minLeadDays,
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
