// ============================================================
// AMISACHE — request.controller.ts
// Routes /requests/*  : self-service fidèle (déposer, consulter les
// siennes) + suivi admin.
//
// Ce controller ne contient AUCUNE logique métier.
// Il délègue tout au RequestService.
// ============================================================
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

import { RequestService } from '../services/request.service';
import { GetUser, Roles } from '../../core/decorators/api.decorator';
import { UserRole } from '../../shared/common.enum';
import { JwtUserInfo } from '../../auth/dto/auth.type.dto';
import { RequestStatus } from '../liturgy.enum';

import { CreateRequestDto, UpdateRequestStatusDto } from '../dto/request.dto';
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
  @ApiOperation({ summary: '[Admin] Lister toutes les demandes (filtrable)' })
  @ApiQuery({ name: 'churchId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: RequestStatus })
  listAdmin(@Query() query: ListRequestQuery) {
    return this.requestService.listAdmin(query);
  }

  /** POST /requests — déposer une demande (intention ou sacrement) */
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Déposer une demande (intention de messe ou sacrement)' })
  create(@GetUser() user: JwtUserInfo, @Body() body: CreateRequestDto) {
    return this.requestService.create(user.id, body);
  }

  /** GET /requests/:id — le demandeur lui-même, ou l'admin/engineer */
  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Récupérer une demande par id' })
  getById(@GetUser() user: JwtUserInfo, @Param('id') id: string) {
    const isAdmin = [UserRole.admin, UserRole.engineer].some((r) =>
      user.roles?.includes(r),
    );
    return isAdmin
      ? this.requestService.getById(id)
      : this.requestService.getMineById(id, user.id);
  }

  /** PATCH /requests/:id/status — admin, engineer */
  @Patch(':id/status')
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: "[Admin] Changer le statut d'une demande" })
  updateStatus(@Param('id') id: string, @Body() body: UpdateRequestStatusDto) {
    return this.requestService.updateStatus(id, body);
  }
}
