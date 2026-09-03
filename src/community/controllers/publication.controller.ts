// ============================================================
// AMISACHE — publication.controller.ts
// Routes /publications/*  : fil public (publiées, dans leur fenêtre
// d'affichage) + gestion admin.
//
// Ce controller ne contient AUCUNE logique métier.
// Il délègue tout au PublicationService.
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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

import { PublicationService } from '../services/publication.service';
import { Public, Roles } from '../../core/decorators/api.decorator';
import { UserRole } from '../../shared/common.enum';
import { PublicationStatus } from '../community.enum';

import {
  CreatePublicationDto,
  UpdatePublicationDto,
  UpdatePublicationStatusDto,
} from '../dto/publication.dto';
import type {
  ListPublicationAdminQuery,
  ListPublicationPublicQuery,
} from '../dto/publication.dto';

@ApiTags('Community — Publications')
@Controller('publications')
export class PublicationController {
  constructor(private readonly publicationService: PublicationService) {}

  /** GET /publications — fil public (publiées, dans leur fenêtre d'affichage) */
  @Get()
  @Public()
  @ApiOperation({ summary: "Lister le fil public d'une église (et/ou d'un groupe)" })
  @ApiQuery({ name: 'churchId', required: false, type: String })
  @ApiQuery({ name: 'groupId', required: false, type: String })
  listPublic(@Query() query: ListPublicationPublicQuery) {
    return this.publicationService.listPublic(query);
  }

  /**
   * GET /publications/admin
   * Accessible : admin, engineer.
   * ⚠️ Doit être déclarée AVANT `:id` pour éviter que NestJS
   * interprète "admin" comme un id.
   */
  @Get('admin')
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Lister toutes les publications (tous statuts)' })
  @ApiQuery({ name: 'churchId', required: false, type: String })
  @ApiQuery({ name: 'groupId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: PublicationStatus })
  listAdmin(@Query() query: ListPublicationAdminQuery) {
    return this.publicationService.listAdmin(query);
  }

  /** POST /publications — admin, engineer */
  @Post()
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Créer une publication (brouillon)' })
  create(@Body() body: CreatePublicationDto) {
    return this.publicationService.create(body);
  }

  /** GET /publications/:id — publique uniquement si PUBLISHED */
  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Récupérer une publication publiée par id' })
  getPublicById(@Param('id') id: string) {
    return this.publicationService.getPublicById(id);
  }

  /** PATCH /publications/:id — admin, engineer */
  @Patch(':id')
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Mettre à jour une publication' })
  update(@Param('id') id: string, @Body() body: UpdatePublicationDto) {
    return this.publicationService.update(id, body);
  }

  /** PATCH /publications/:id/status — admin, engineer */
  @Patch(':id/status')
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: "[Admin] Changer le statut d'une publication" })
  updateStatus(@Param('id') id: string, @Body() body: UpdatePublicationStatusDto) {
    return this.publicationService.updateStatus(id, body.status);
  }

  /** DELETE /publications/:id — admin, engineer */
  @Delete(':id')
  @Roles(UserRole.admin, UserRole.engineer)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Supprimer une publication' })
  delete(@Param('id') id: string) {
    return this.publicationService.delete(id);
  }
}
