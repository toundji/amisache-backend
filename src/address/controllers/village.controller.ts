// ============================================================
// AMISACHE — village.controller.ts
// Routes /villages/*  : lecture publique (filtrée par zoneId) + CRUD admin.
//
// Ce controller ne contient AUCUNE logique métier.
// Il délègue tout au VillageService.
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

import { VillageService } from '../services/village.service';
import { Public, Roles } from '../../core/decorators/api.decorator';
import { UserRole } from '../../shared/common.enum';

import { CreateVillageDto, UpdateVillageDto } from '../dto/village.dto';
import type { ListVillageQuery } from '../dto/village.dto';

@ApiTags('Adresse — Villages')
@Controller('villages')
export class VillageController {
  constructor(private readonly villageService: VillageService) {}

  /** GET /villages?zoneId=... — liste publique (non exhaustive) */
  @Get()
  @Public()
  @ApiOperation({ summary: "Lister les villages/quartiers d'une zone" })
  @ApiQuery({ name: 'zoneId', required: true, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  list(@Query() query: ListVillageQuery) {
    return this.villageService.list(query);
  }

  /** GET /villages/:id */
  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Récupérer un village par id' })
  getById(@Param('id') id: string) {
    return this.villageService.getById(id);
  }

  /** POST /villages — admin, engineer */
  @Post()
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Créer un village/quartier' })
  create(@Body() body: CreateVillageDto) {
    return this.villageService.create(body);
  }

  /** PATCH /villages/:id — admin, engineer */
  @Patch(':id')
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Mettre à jour un village/quartier' })
  update(@Param('id') id: string, @Body() body: UpdateVillageDto) {
    return this.villageService.update(id, body);
  }

  /** DELETE /villages/:id — admin uniquement */
  @Delete(':id')
  @Roles(UserRole.admin)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Supprimer un village/quartier' })
  delete(@Param('id') id: string) {
    return this.villageService.delete(id);
  }
}
