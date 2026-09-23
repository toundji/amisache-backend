// ============================================================
// AMISACHE — tariff.controller.ts
// Routes /tariffs/* : résolution publique (le fidèle doit voir le montant
// avant de payer) + gestion par le clergé de l'église concernée (ou admin).
//
// Ce controller ne contient AUCUNE logique métier.
// Il délègue tout au TariffService.
// ============================================================
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

import { TariffService } from '../services/tariff.service';
import { GetUser, Public, Roles } from '../../core/decorators/api.decorator';
import { UserRole } from '../../shared/common.enum';
import { JwtUserInfo } from '../../auth/dto/auth.type.dto';

import { CreateTariffDto, UpdateTariffDto } from '../dto/tariff.dto';
import type { ListTariffQuery } from '../dto/tariff.dto';

@ApiTags('Liturgy — Tarifs')
@Controller('tariffs')
export class TariffController {
  constructor(private readonly tariffService: TariffService) {}

  /**
   * GET /tariffs/resolve?churchId=&typeId= — montant applicable, avec repli
   * hiérarchique. `null` si aucun tarif n'est configuré — le fidèle saisit
   * alors un montant libre.
   */
  @Get('resolve')
  @Public()
  @ApiOperation({ summary: 'Résoudre le tarif applicable (avec repli hiérarchique)' })
  @ApiQuery({ name: 'churchId', required: true, type: String })
  @ApiQuery({ name: 'typeId', required: true, type: String })
  resolve(@Query('churchId') churchId: string, @Query('typeId') typeId: string) {
    return this.tariffService.resolve(churchId, typeId);
  }

  /**
   * GET /tariffs/admin — liste complète, toutes églises.
   * ⚠️ Déclarée AVANT `:id`.
   */
  @Get('admin')
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Liste complète des tarifs (toutes églises)' })
  @ApiQuery({ name: 'churchId', required: false, type: String })
  listAdmin(@Query() query: ListTariffQuery) {
    return this.tariffService.listAdmin(query);
  }

  /**
   * GET /tariffs/church/:churchId — tarifs propres à UNE église (pas la
   * résolution avec repli). Accès : admin/engineer, ou clergé ACTIF de cette
   * église.
   */
  @Get('church/:churchId')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Liste des tarifs propres à une église (clergé de cette église, ou admin)" })
  listForChurch(@GetUser() user: JwtUserInfo, @Param('churchId') churchId: string) {
    return this.tariffService.listForChurch(user, churchId);
  }

  /**
   * GET /tariffs/:id — admin/engineer (toute église), ou clergé ACTIF de
   * l'église de ce tarif (écran de gestion du panel — pas consommée par le
   * portail public, qui ne passe que par `resolve`). ⚠️ Déclarée APRÈS
   * `resolve`/`admin`/`church/:churchId`.
   */
  @Get(':id')
  @Roles(UserRole.admin, UserRole.engineer, UserRole.clergy)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Récupérer un tarif par id (admin, ou clergé de cette église)' })
  getById(@GetUser() user: JwtUserInfo, @Param('id') id: string) {
    const isAdmin = [UserRole.admin, UserRole.engineer].some((r) => user.roles?.includes(r));
    return isAdmin ? this.tariffService.getById(id) : this.tariffService.getByIdForClergy(id, user);
  }

  /** POST /tariffs — admin, engineer, ou clergé actif de l'église visée */
  @Post()
  @Roles(UserRole.admin, UserRole.engineer, UserRole.clergy)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Publier un tarif pour une église (admin, ou clergé de cette église)' })
  create(@GetUser() user: JwtUserInfo, @Body() body: CreateTariffDto) {
    return this.tariffService.create(user, body);
  }

  /** PATCH /tariffs/:id — admin, engineer, ou clergé actif de l'église visée */
  @Patch(':id')
  @Roles(UserRole.admin, UserRole.engineer, UserRole.clergy)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mettre à jour un tarif (admin, ou clergé de cette église)' })
  update(@GetUser() user: JwtUserInfo, @Param('id') id: string, @Body() body: UpdateTariffDto) {
    return this.tariffService.update(user, id, body);
  }

  /** DELETE /tariffs/:id — admin, engineer, ou clergé actif de l'église visée */
  @Delete(':id')
  @Roles(UserRole.admin, UserRole.engineer, UserRole.clergy)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Supprimer un tarif (admin, ou clergé de cette église)' })
  delete(@GetUser() user: JwtUserInfo, @Param('id') id: string) {
    return this.tariffService.delete(user, id);
  }
}
