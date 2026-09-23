// ============================================================
// AMISACHE — request.controller.ts
// Routes /requests/*  : self-service fidèle (déposer, consulter les
// siennes) + suivi admin.
//
// Ce controller ne contient AUCUNE logique métier.
// Il délègue tout au RequestService.
// ============================================================
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiQuery } from '@nestjs/swagger';
import { FormDataRequest } from 'nestjs-form-data';

import { RequestService } from '../services/request.service';
import { GetUser, Roles } from '../../core/decorators/api.decorator';
import { UserRole } from '../../shared/common.enum';
import { JwtUserInfo } from '../../auth/dto/auth.type.dto';
import { RequestStatus } from '../liturgy.enum';

import { CreateRequestDto, RequestAttachmentUploadDto, UpdateRequestStatusDto } from '../dto/request.dto';
import type { ListRequestQuery } from '../dto/request.dto';

@ApiTags('Liturgy — Demandes')
@Controller('requests')
export class RequestController {
  constructor(private readonly requestService: RequestService) {}

  /** GET /requests/me — mes demandes (intentions/sacrements) */
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lister mes demandes' })
  listMine(@GetUser() user: JwtUserInfo) {
    return this.requestService.listMine(user.id);
  }

  /**
   * GET /requests/admin?churchId=...&status=...
   * Accessible : admin, engineer.
   * ⚠️ Doit être déclarée AVANT `:id` pour éviter que NestJS
   * interprète "admin" comme un id.
   */
  @Get('admin')
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Liste complète des demandes (toutes églises, filtre statut)' })
  @ApiQuery({ name: 'status', required: false, enum: RequestStatus })
  @ApiQuery({ name: 'churchId', required: false, type: String, description: 'Déprécié — préférer /requests/church/:churchId' })
  listAdmin(@Query() query: ListRequestQuery) {
    return this.requestService.listAdmin(query);
  }

  /**
   * GET /requests/church/:churchId — demandes d'UNE église.
   * Accès : admin/engineer, ou membre du clergé ACTIF de cette église.
   * ⚠️ Déclarée AVANT `:id`.
   */
  @Get('church/:churchId')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Liste complète des demandes d'une église (clergé de cette église, ou admin)" })
  @ApiQuery({ name: 'status', required: false, enum: RequestStatus })
  listForChurch(
    @GetUser() user: JwtUserInfo,
    @Param('churchId') churchId: string,
    @Query() query: ListRequestQuery,
  ) {
    return this.requestService.listForChurch(user, churchId, query);
  }

  /** POST /requests — déposer une demande (intention ou sacrement) */
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Déposer une demande (intention de messe ou sacrement)' })
  create(@GetUser() user: JwtUserInfo, @Body() body: CreateRequestDto) {
    return this.requestService.create(user.id, body);
  }

  /**
   * POST /requests/attachment — upload d'une pièce jointe libre (prière,
   * contenu spécifique — image ou PDF), avant soumission de la demande.
   * ⚠️ Déclarée AVANT `:id`.
   */
  @Post('attachment')
  @FormDataRequest()
  @ApiConsumes('multipart/form-data')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Uploader une pièce jointe pour une demande (image ou PDF)" })
  uploadAttachment(@Body() body: RequestAttachmentUploadDto) {
    return this.requestService.uploadAttachment(body);
  }

  /** GET /requests/:id — le demandeur lui-même, le clergé ACTIF de l'église visée, ou l'admin/engineer */
  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Récupérer une demande par id' })
  getById(@GetUser() user: JwtUserInfo, @Param('id') id: string) {
    const isAdmin = [UserRole.admin, UserRole.engineer].some((r) =>
      user.roles?.includes(r),
    );
    return isAdmin
      ? this.requestService.getById(id)
      : this.requestService.getByIdForRequesterOrClergy(id, user);
  }

  /** PATCH /requests/:id/status — admin/engineer, ou clergé ACTIF de l'église de cette demande */
  @Patch(':id/status')
  @Roles(UserRole.admin, UserRole.engineer, UserRole.clergy)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Changer le statut d'une demande (admin, ou clergé de cette église)" })
  updateStatus(
    @GetUser() user: JwtUserInfo,
    @Param('id') id: string,
    @Body() body: UpdateRequestStatusDto,
  ) {
    return this.requestService.updateStatus(user, id, body);
  }
}
