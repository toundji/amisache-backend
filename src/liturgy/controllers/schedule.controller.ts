// ============================================================
// AMISACHE — schedule.controller.ts
// Routes /schedules/*  : lecture publique (filtrée par churchId) + CRUD admin.
//
// Ce controller ne contient AUCUNE logique métier.
// Il délègue tout au ScheduleService.
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

import { ScheduleService } from '../services/schedule.service';
import { GetUser, Public, Roles } from '../../core/decorators/api.decorator';
import { UserRole } from '../../shared/common.enum';
import { JwtUserInfo } from '../../auth/dto/auth.type.dto';

import { CreateScheduleDto, UpdateScheduleDto } from '../dto/schedule.dto';
import type { ListScheduleQuery } from '../dto/schedule.dto';

@ApiTags('Liturgy — Horaires')
@Controller('schedules')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  /** GET /schedules?churchId=... — liste publique */
  @Get()
  @Public()
  @ApiOperation({ summary: "Lister les horaires d'une église" })
  @ApiQuery({ name: 'churchId', required: true, type: String })
  list(@Query() query: ListScheduleQuery) {
    return this.scheduleService.list(query);
  }

  /**
   * GET /schedules/admin — liste complète, toutes églises.
   * ⚠️ Déclarée AVANT `:id`.
   */
  @Get('admin')
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Liste complète des horaires (toutes églises)' })
  listAdmin() {
    return this.scheduleService.listAdmin();
  }

  /**
   * GET /schedules/church/:churchId — horaires d'UNE église.
   * Accès : admin/engineer, ou membre du clergé ACTIF de cette église.
   */
  @Get('church/:churchId')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Liste complète des horaires d'une église (clergé de cette église, ou admin)" })
  listForChurch(@GetUser() user: JwtUserInfo, @Param('churchId') churchId: string) {
    return this.scheduleService.listForChurch(user, churchId);
  }

  /** GET /schedules/:id */
  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Récupérer un horaire par id' })
  getById(@Param('id') id: string) {
    return this.scheduleService.getById(id);
  }

  /** POST /schedules — admin, engineer, ou clergé actif de l'église visée */
  @Post()
  @Roles(UserRole.admin, UserRole.engineer, UserRole.clergy)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Créer un horaire liturgique (admin, ou clergé de cette église)' })
  create(@GetUser() user: JwtUserInfo, @Body() body: CreateScheduleDto) {
    return this.scheduleService.create(user, body);
  }

  /** PATCH /schedules/:id — admin, engineer, ou clergé actif de l'église visée */
  @Patch(':id')
  @Roles(UserRole.admin, UserRole.engineer, UserRole.clergy)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mettre à jour un horaire (admin, ou clergé de cette église)' })
  update(@GetUser() user: JwtUserInfo, @Param('id') id: string, @Body() body: UpdateScheduleDto) {
    return this.scheduleService.update(user, id, body);
  }

  /** DELETE /schedules/:id — admin, engineer, ou clergé actif de l'église visée */
  @Delete(':id')
  @Roles(UserRole.admin, UserRole.engineer, UserRole.clergy)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Supprimer un horaire (admin, ou clergé de cette église)' })
  delete(@GetUser() user: JwtUserInfo, @Param('id') id: string) {
    return this.scheduleService.delete(user, id);
  }
}
