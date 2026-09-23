// ============================================================
// AMISACHE — liturgical-period.controller.ts
// Routes /liturgical-periods/*  : lecture publique + CRUD admin.
//
// Ce controller ne contient AUCUNE logique métier.
// Il délègue tout au LiturgicalPeriodService.
// ============================================================
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

import { LiturgicalPeriodService } from '../services/liturgical-period.service';
import { Public, Roles } from '../../core/decorators/api.decorator';
import { UserRole } from '../../shared/common.enum';

import { CreateLiturgicalPeriodDto, UpdateLiturgicalPeriodDto } from '../dto/liturgical-period.dto';

@ApiTags('Content — Temps liturgique')
@Controller('liturgical-periods')
export class LiturgicalPeriodController {
  constructor(private readonly periodService: LiturgicalPeriodService) {}

  /** GET /liturgical-periods/status — période en cours + prochaine, avec agrégat public */
  @Get('status')
  @Public()
  @ApiOperation({ summary: 'Période liturgique en cours et prochaine (avec paroisses ayant publié)' })
  getStatus() {
    return this.periodService.getStatus();
  }

  /**
   * GET /liturgical-periods/admin — liste complète.
   * ⚠️ Déclarée AVANT `:id`.
   */
  @Get('admin')
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Liste complète des périodes liturgiques' })
  listAdmin() {
    return this.periodService.listAdmin();
  }

  /** GET /liturgical-periods/:id */
  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Récupérer une période liturgique par id' })
  getById(@Param('id') id: string) {
    return this.periodService.getById(id);
  }

  /** POST /liturgical-periods — admin, engineer */
  @Post()
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Créer une période liturgique' })
  create(@Body() body: CreateLiturgicalPeriodDto) {
    return this.periodService.create(body);
  }

  /** PATCH /liturgical-periods/:id — admin, engineer */
  @Patch(':id')
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Mettre à jour une période liturgique' })
  update(@Param('id') id: string, @Body() body: UpdateLiturgicalPeriodDto) {
    return this.periodService.update(id, body);
  }

  /** DELETE /liturgical-periods/:id — admin, engineer */
  @Delete(':id')
  @Roles(UserRole.admin, UserRole.engineer)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Supprimer une période liturgique' })
  delete(@Param('id') id: string) {
    return this.periodService.delete(id);
  }
}
