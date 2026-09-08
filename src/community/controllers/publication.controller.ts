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
import { GetUser, Public, Roles } from '../../core/decorators/api.decorator';
import { UserRole } from '../../shared/common.enum';
import { JwtUserInfo } from '../../auth/dto/auth.type.dto';
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
  @ApiOperation({ summary: '[Admin] Liste complète des publications (toutes églises, tous statuts)' })
  @ApiQuery({ name: 'groupId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: PublicationStatus })
  @ApiQuery({ name: 'churchId', required: false, type: String, description: 'Déprécié — préférer /publications/church/:churchId' })
  listAdmin(@Query() query: ListPublicationAdminQuery) {
    return this.publicationService.listAdmin(query);
  }

  /**
   * GET /publications/church/:churchId — publications d'UNE église (tous statuts).
   * Accès : admin/engineer, ou membre du clergé ACTIF de cette église.
   * ⚠️ Déclarée AVANT `:id`.
   */
  @Get('church/:churchId')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Liste complète des publications d'une église (clergé de cette église, ou admin)" })
  @ApiQuery({ name: 'groupId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: PublicationStatus })
  listForChurch(
    @GetUser() user: JwtUserInfo,
    @Param('churchId') churchId: string,
    @Query() query: ListPublicationAdminQuery,
  ) {
    return this.publicationService.listForChurch(user, churchId, query);
  }

  /** POST /publications — admin, engineer, ou clergé actif de l'église visée */
  @Post()
  @Roles(UserRole.admin, UserRole.engineer, UserRole.clergy)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Créer une publication (admin, ou clergé de cette église)' })
  create(@GetUser() user: JwtUserInfo, @Body() body: CreatePublicationDto) {
    return this.publicationService.create(user, body);
  }

  /** GET /publications/:id — publique uniquement si PUBLISHED */
  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Récupérer une publication publiée par id' })
  getPublicById(@Param('id') id: string) {
    return this.publicationService.getPublicById(id);
  }

  /** PATCH /publications/:id — admin, engineer, ou clergé actif de l'église visée */
  @Patch(':id')
  @Roles(UserRole.admin, UserRole.engineer, UserRole.clergy)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mettre à jour une publication (admin, ou clergé de cette église)' })
  update(
    @GetUser() user: JwtUserInfo,
    @Param('id') id: string,
    @Body() body: UpdatePublicationDto,
  ) {
    return this.publicationService.update(user, id, body);
  }

  /** PATCH /publications/:id/status — admin, engineer, ou clergé actif de l'église visée */
  @Patch(':id/status')
  @Roles(UserRole.admin, UserRole.engineer, UserRole.clergy)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Changer le statut d'une publication (admin, ou clergé de cette église)" })
  updateStatus(
    @GetUser() user: JwtUserInfo,
    @Param('id') id: string,
    @Body() body: UpdatePublicationStatusDto,
  ) {
    return this.publicationService.updateStatus(user, id, body.status);
  }

  /** DELETE /publications/:id — admin, engineer, ou clergé actif de l'église visée */
  @Delete(':id')
  @Roles(UserRole.admin, UserRole.engineer, UserRole.clergy)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Supprimer une publication (admin, ou clergé de cette église)' })
  delete(@GetUser() user: JwtUserInfo, @Param('id') id: string) {
    return this.publicationService.delete(user, id);
  }
}
