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
import { Public, Roles } from '../../core/decorators/api.decorator';
import { UserRole } from '../../shared/common.enum';

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

  /** GET /schedules/:id */
  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Récupérer un horaire par id' })
  getById(@Param('id') id: string) {
    return this.scheduleService.getById(id);
  }

  /** POST /schedules — admin, engineer */
  @Post()
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Créer un horaire liturgique' })
  create(@Body() body: CreateScheduleDto) {
    return this.scheduleService.create(body);
  }

  /** PATCH /schedules/:id — admin, engineer */
  @Patch(':id')
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Mettre à jour un horaire' })
  update(@Param('id') id: string, @Body() body: UpdateScheduleDto) {
    return this.scheduleService.update(id, body);
  }

  /** DELETE /schedules/:id — admin, engineer */
  @Delete(':id')
  @Roles(UserRole.admin, UserRole.engineer)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Supprimer un horaire' })
  delete(@Param('id') id: string) {
    return this.scheduleService.delete(id);
  }
}
