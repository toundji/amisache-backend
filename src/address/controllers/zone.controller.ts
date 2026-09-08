// ============================================================
// AMISACHE — zone.controller.ts
// Routes /zones/*  : lecture publique (filtrée par regionId) + CRUD admin.
//
// Ce controller ne contient AUCUNE logique métier.
// Il délègue tout au ZoneService.
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

import { ZoneService } from '../services/zone.service';
import { Public, Roles } from '../../core/decorators/api.decorator';
import { UserRole } from '../../shared/common.enum';

import { CreateZoneDto, UpdateZoneDto } from '../dto/zone.dto';
import type { ListZoneQuery } from '../dto/zone.dto';

@ApiTags('Adresse — Zones')
@Controller('zones')
export class ZoneController {
  constructor(private readonly zoneService: ZoneService) {}

  /** GET /zones?regionId=... — liste publique ; regionId optionnel (absent → toutes) */
  @Get()
  @Public()
  @ApiOperation({ summary: 'Lister les zones (toutes, ou filtrées par région)' })
  @ApiQuery({ name: 'regionId', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  list(@Query() query: ListZoneQuery) {
    return this.zoneService.list(query);
  }

  /** GET /zones/:id */
  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Récupérer une zone par id' })
  getById(@Param('id') id: string) {
    return this.zoneService.getById(id);
  }

  /** POST /zones — admin, engineer */
  @Post()
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Créer une zone' })
  create(@Body() body: CreateZoneDto) {
    return this.zoneService.create(body);
  }

  /** PATCH /zones/:id — admin, engineer */
  @Patch(':id')
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Mettre à jour une zone' })
  update(@Param('id') id: string, @Body() body: UpdateZoneDto) {
    return this.zoneService.update(id, body);
  }

  /** DELETE /zones/:id — admin uniquement */
  @Delete(':id')
  @Roles(UserRole.admin)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Supprimer une zone' })
  delete(@Param('id') id: string) {
    return this.zoneService.delete(id);
  }
}
