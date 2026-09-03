// ============================================================
// AMISACHE — region.controller.ts
// Routes /regions/*  : lecture publique (filtrée par countryId) + CRUD admin.
//
// Ce controller ne contient AUCUNE logique métier.
// Il délègue tout au RegionService.
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

import { RegionService } from '../services/region.service';
import { Public, Roles } from '../../core/decorators/api.decorator';
import { UserRole } from '../../shared/common.enum';

import { CreateRegionDto, UpdateRegionDto } from '../dto/region.dto';
import type { ListRegionQuery } from '../dto/region.dto';

@ApiTags('Adresse — Régions')
@Controller('regions')
export class RegionController {
  constructor(private readonly regionService: RegionService) {}

  /** GET /regions?countryId=... — liste publique */
  @Get()
  @Public()
  @ApiOperation({ summary: "Lister les régions d'un pays" })
  @ApiQuery({ name: 'countryId', required: true, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  list(@Query() query: ListRegionQuery) {
    return this.regionService.list(query);
  }

  /** GET /regions/:id */
  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Récupérer une région par id' })
  getById(@Param('id') id: string) {
    return this.regionService.getById(id);
  }

  /** POST /regions — admin, engineer */
  @Post()
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Créer une région' })
  create(@Body() body: CreateRegionDto) {
    return this.regionService.create(body);
  }

  /** PATCH /regions/:id — admin, engineer */
  @Patch(':id')
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Mettre à jour une région' })
  update(@Param('id') id: string, @Body() body: UpdateRegionDto) {
    return this.regionService.update(id, body);
  }

  /** DELETE /regions/:id — admin uniquement */
  @Delete(':id')
  @Roles(UserRole.admin)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Supprimer une région' })
  delete(@Param('id') id: string) {
    return this.regionService.delete(id);
  }
}
