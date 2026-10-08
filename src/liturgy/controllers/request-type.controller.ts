// ============================================================
// AMISACHE — request-type.controller.ts
// Routes /request-types/*  : lecture publique (par scope) + CRUD admin.
//
// Ce controller ne contient AUCUNE logique métier.
// Il délègue tout au RequestTypeService.
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

import { RequestTypeService } from '../services/request-type.service';
import { Public, Roles } from '../../core/decorators/api.decorator';
import { UserRole } from '../../shared/common.enum';
import { RequestTypeScope } from '../request-type.enum';

import { CreateRequestTypeDto, UpdateRequestTypeDto } from '../dto/request-type.dto';
import type { ListRequestTypeAdminQuery, ListRequestTypePublicQuery } from '../dto/request-type.dto';

@ApiTags('Types de demande')
@Controller('request-types')
export class RequestTypeController {
  constructor(private readonly requestTypeService: RequestTypeService) {}

  // ── Public ────────────────────────────────────────────────

  /**
   * GET /request-types
   * Liste les types actifs, filtrés par scope — alimente le formulaire de
   * demande (intention/sacrement) et l'assistant du chat.
   */
  @Get()
  @Public()
  @ApiOperation({ summary: 'Lister les types de demande actifs (filtrable par scope)' })
  @ApiQuery({ name: 'scope', required: false, enum: RequestTypeScope })
  listActive(@Query() query: ListRequestTypePublicQuery) {
    return this.requestTypeService.listActive(query);
  }

  // ── Admin — liste ─────────────────────────────────────────

  /**
   * GET /request-types/admin
   * Liste paginée de tous les types de demande, y compris inactifs.
   * ⚠️ Déclarée AVANT `:id` pour éviter que NestJS interprète "admin" comme un id.
   */
  @Get('admin')
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Lister tous les types de demande (paginé + filtres)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'scope', required: false, enum: RequestTypeScope })
  @ApiQuery({ name: 'active', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false, type: String })
  listAdmin(@Query() query: ListRequestTypeAdminQuery) {
    return this.requestTypeService.listAdmin(query);
  }

  // ── Admin — création ──────────────────────────────────────

  @Post()
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Créer un type de demande' })
  create(@Body() body: CreateRequestTypeDto) {
    return this.requestTypeService.create(body);
  }

  // ── Public — détail ───────────────────────────────────────

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Récupérer un type de demande par id' })
  getById(@Param('id') id: string) {
    return this.requestTypeService.getById(id);
  }

  // ── Admin — mise à jour ───────────────────────────────────

  @Patch(':id')
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Mettre à jour un type de demande' })
  update(@Param('id') id: string, @Body() body: UpdateRequestTypeDto) {
    return this.requestTypeService.update(id, body);
  }

  // ── Admin — suppression ───────────────────────────────────

  @Delete(':id')
  @Roles(UserRole.admin)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Supprimer un type de demande' })
  delete(@Param('id') id: string) {
    return this.requestTypeService.delete(id);
  }
}
