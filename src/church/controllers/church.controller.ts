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
import { Public, Roles } from '../../core/decorators/api.decorator';
import { UserRole } from '../../shared/common.enum';
import { EntityType, ValidationStatus } from '../church.enum';
import { ImageDto } from '../../shared/media.dto';

// ⚠️ Import de valeur obligatoire (pas `import type`) pour les DTOs utilisés
// avec @Body() — voir la note équivalente sur users/controllers/user.controller.ts.
import {
  CreateChurchDto,
  SetPerimeterDto,
  UpdateChurchDto,
  UpdateChurchStatusDto,
} from '../dto/church.dto';
import type { ListChurchAdminQuery, ListChurchPublicQuery } from '../dto/church.dto';

@ApiTags('Church')
@Controller('churches')
export class ChurchController {
  constructor(private readonly churchService: ChurchService) {}

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

  /** GET /churches/:id — admin, engineer (voit aussi PENDING/SUSPENDED) */
  @Get(':id')
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Récupérer une entité par id, quel que soit son statut' })
  getById(@Param('id') id: string) {
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

  /** POST /churches/:id/banner — admin, engineer */
  @Post(':id/banner')
  @Roles(UserRole.admin, UserRole.engineer)
  @FormDataRequest()
  @ApiConsumes('multipart/form-data')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Uploader la photo de bannière' })
  updateBanner(@Param('id') id: string, @Body() body: ImageDto) {
    return this.churchService.updateBanner(id, body);
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
