// ============================================================
// AMISACHE — entrance.controller.ts
// Routes /entrances/*  : lecture publique (filtrée par churchId) + CRUD admin.
//
// Ce controller ne contient AUCUNE logique métier.
// Il délègue tout au EntranceService.
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

import { EntranceService } from '../services/entrance.service';
import { GetUser, Public, Roles } from '../../core/decorators/api.decorator';
import { UserRole } from '../../shared/common.enum';
import { JwtUserInfo } from '../../auth/dto/auth.type.dto';

import { CreateEntranceDto, UpdateEntranceDto } from '../dto/entrance.dto';
import type { ListEntranceQuery } from '../dto/entrance.dto';

@ApiTags('Church — Entrées')
@Controller('entrances')
export class EntranceController {
  constructor(private readonly entranceService: EntranceService) {}

  /** GET /entrances?churchId=... — churchId optionnel (absent → toutes) */
  @Get()
  @Public()
  @ApiOperation({ summary: "Lister les entrées (toutes, ou pour une église)" })
  @ApiQuery({ name: 'churchId', required: false, type: String })
  list(@Query() query: ListEntranceQuery) {
    return this.entranceService.list(query);
  }

  /**
   * GET /entrances/admin — liste complète, toutes églises.
   * ⚠️ Déclarée AVANT `:id`.
   */
  @Get('admin')
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Liste complète des entrées (toutes églises)' })
  listAdmin() {
    return this.entranceService.listAdmin();
  }

  /**
   * GET /entrances/church/:churchId — liste complète d'UNE église.
   * Accès : admin/engineer, ou membre du clergé ACTIF de cette église.
   */
  @Get('church/:churchId')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Liste complète des entrées d'une église (clergé de cette église, ou admin)" })
  listForChurch(@GetUser() user: JwtUserInfo, @Param('churchId') churchId: string) {
    return this.entranceService.listForChurch(user, churchId);
  }

  /** GET /entrances/:id */
  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Récupérer une entrée par id' })
  getById(@Param('id') id: string) {
    return this.entranceService.getById(id);
  }

  /** POST /entrances — admin, engineer */
  @Post()
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Créer une entrée' })
  create(@Body() body: CreateEntranceDto) {
    return this.entranceService.create(body);
  }

  /** PATCH /entrances/:id — admin, engineer */
  @Patch(':id')
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Mettre à jour une entrée' })
  update(@Param('id') id: string, @Body() body: UpdateEntranceDto) {
    return this.entranceService.update(id, body);
  }

  /** DELETE /entrances/:id — admin, engineer */
  @Delete(':id')
  @Roles(UserRole.admin, UserRole.engineer)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Supprimer une entrée' })
  delete(@Param('id') id: string) {
    return this.entranceService.delete(id);
  }
}
