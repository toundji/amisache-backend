// ============================================================
// AMISACHE — church.controller.ts
// Routes /churches/*  : lecture publique (annuaire) + gestion admin.
//
// Ce controller ne contient AUCUNE logique métier.
// Il délègue tout au ChurchService.
// ============================================================
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiQuery } from '@nestjs/swagger';
import { FormDataRequest } from 'nestjs-form-data';

import { ChurchService } from '../services/church.service';
import { ClergyMemberService } from '../services/clergy-member.service';
import { GetUser, Public, Roles } from '../../core/decorators/api.decorator';
import { UserRole } from '../../shared/common.enum';
import { EntityType, ValidationStatus } from '../church.enum';
import { JwtUserInfo } from '../../auth/dto/auth.type.dto';

// ⚠️ Import de valeur obligatoire (pas `import type`) pour les DTOs utilisés
// avec @Body() — voir la note équivalente sur users/controllers/user.controller.ts.
import {
  CreateChurchDto,
  SetPerimeterDto,
  UpdateChurchDto,
  UpdateChurchImageDto,
  UpdateChurchPhotosDto,
  UpdateChurchStatusDto,
} from '../dto/church.dto';
import type { ListChurchAdminQuery, ListChurchPublicQuery } from '../dto/church.dto';

@ApiTags('Church')
@Controller('churches')
export class ChurchController {
  constructor(
    private readonly churchService: ChurchService,
    private readonly clergyMemberService: ClergyMemberService,
  ) {}

  // ── Public — annuaire ─────────────────────────────────────

  /** GET /churches — annuaire public (entités approuvées uniquement) */
  @Get()
  @Public()
  @ApiOperation({ summary: 'Lister les entités approuvées (annuaire public)' })
  @ApiQuery({ name: 'type', required: false, enum: EntityType })
  @ApiQuery({ name: 'parentId', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listPublic(@Query() query: ListChurchPublicQuery) {
    return this.churchService.listPublic(query);
  }

  /** GET /churches/slug/:slug — page publique d'une entité */
  @Get('slug/:slug')
  @Public()
  @ApiOperation({ summary: 'Récupérer une entité approuvée par son slug' })
  getBySlug(@Param('slug') slug: string) {
    return this.churchService.getPublicBySlug(slug);
  }

  // ── Admin — liste tous statuts ────────────────────────────

  /**
   * GET /churches/admin
   * Accessible : admin, engineer.
   * ⚠️ Doit être déclarée AVANT `:id` pour éviter que NestJS
   * interprète "admin" comme un id.
   */
  @Get('admin')
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Lister toutes les entités (paginé + filtres)' })
  @ApiQuery({ name: 'status', required: false, enum: ValidationStatus })
  @ApiQuery({ name: 'type', required: false, enum: EntityType })
  @ApiQuery({ name: 'parentId', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listAdmin(@Query() query: ListChurchAdminQuery) {
    return this.churchService.listAdmin(query);
  }

  // ── Admin — création ──────────────────────────────────────

  /** POST /churches — admin, engineer */
  @Post()
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Créer une entité de la hiérarchie ecclésiale' })
  create(@Body() body: CreateChurchDto) {
    return this.churchService.create(body);
  }

  // ── Admin — détail par id ─────────────────────────────────

  /**
   * GET /churches/:id — admin/engineer, ou membre du clergé ACTIF de cette
   * église (le panel doit pouvoir afficher la fiche de SA paroisse même en
   * statut PENDING/SUSPENDED — même garde que les ressources church/:churchId).
   */
  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Récupérer une entité par id, quel que soit son statut (admin, ou clergé de cette église)' })
  async getById(@GetUser() user: JwtUserInfo, @Param('id') id: string) {
    await this.clergyMemberService.assertAuthorizedForChurch(user, id);
    return this.churchService.getById(id);
  }

  // ── Admin — mise à jour ───────────────────────────────────

  /** PATCH /churches/:id — admin, engineer */
  @Patch(':id')
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Mettre à jour une entité' })
  update(@Param('id') id: string, @Body() body: UpdateChurchDto) {
    return this.churchService.update(id, body);
  }

  /** PATCH /churches/:id/status — admin uniquement (approuver/suspendre) */
  @Patch(':id/status')
  @Roles(UserRole.admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: "[Admin] Changer le statut de validation d'une entité" })
  updateStatus(@Param('id') id: string, @Body() body: UpdateChurchStatusDto) {
    return this.churchService.updateStatus(id, body.status);
  }

  /** PATCH /churches/:id/perimeter — admin, engineer */
  @Patch(':id/perimeter')
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: "[Admin] Définir l'emprise géographique (4 à 20 sommets)" })
  setPerimeter(@Param('id') id: string, @Body() body: SetPerimeterDto) {
    return this.churchService.setPerimeter(id, body);
  }

  /**
   * POST /churches/:id/banner — admin/engineer, ou clergé ACTIF de cette
   * église (contenu de présentation, pas la structure — cf. PATCH /:id).
   * Vérification faite ici (pas dans ChurchService, qui ne dépend jamais de
   * ClergyMemberService — c'est l'inverse, cf. clergy-member.service.ts).
   */
  @Post(':id/banner')
  @Roles(UserRole.admin, UserRole.engineer, UserRole.clergy)
  @FormDataRequest()
  @ApiConsumes('multipart/form-data')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Uploader la photo de bannière (admin, ou clergé de cette église)' })
  async updateBanner(@GetUser() user: JwtUserInfo, @Param('id') id: string, @Body() body: UpdateChurchImageDto) {
    await this.clergyMemberService.assertAuthorizedForChurch(user, id);
    return this.churchService.updateBanner(id, body);
  }

  /** POST /churches/:id/logo — admin/engineer, ou clergé ACTIF de cette église */
  @Post(':id/logo')
  @Roles(UserRole.admin, UserRole.engineer, UserRole.clergy)
  @FormDataRequest()
  @ApiConsumes('multipart/form-data')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Uploader le logo (admin, ou clergé de cette église)' })
  async updateLogo(@GetUser() user: JwtUserInfo, @Param('id') id: string, @Body() body: UpdateChurchImageDto) {
    await this.clergyMemberService.assertAuthorizedForChurch(user, id);
    return this.churchService.updateLogo(id, body);
  }

  /** POST /churches/:id/photos — admin/engineer, ou clergé ACTIF de cette église */
  @Post(':id/photos')
  @Roles(UserRole.admin, UserRole.engineer, UserRole.clergy)
  @FormDataRequest()
  @ApiConsumes('multipart/form-data')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ajouter une ou plusieurs photos à la galerie (admin, ou clergé de cette église)' })
  async addPhotos(@GetUser() user: JwtUserInfo, @Param('id') id: string, @Body() body: UpdateChurchPhotosDto) {
    await this.clergyMemberService.assertAuthorizedForChurch(user, id);
    return this.churchService.addPhotos(id, body);
  }

  /** DELETE /churches/:id/photos — admin/engineer, ou clergé ACTIF de cette église */
  @Delete(':id/photos')
  @Roles(UserRole.admin, UserRole.engineer, UserRole.clergy)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retirer une photo de la galerie (admin, ou clergé de cette église)' })
  async removePhoto(@GetUser() user: JwtUserInfo, @Param('id') id: string, @Body() body: { url: string }) {
    await this.clergyMemberService.assertAuthorizedForChurch(user, id);
    return this.churchService.removePhoto(id, body.url);
  }

  // ── Admin — suppression ───────────────────────────────────

  /**
   * DELETE /churches/:id — admin uniquement.
   * ⚠️ Refusée par la contrainte FK (RESTRICT) tant que l'entité a des enfants.
   */
  @Delete(':id')
  @Roles(UserRole.admin)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Supprimer une entité (bloqué si elle a des enfants)' })
  delete(@Param('id') id: string) {
    return this.churchService.delete(id);
  }
}
