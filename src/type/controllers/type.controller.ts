// ============================================================
// AMISACHE — type.controller.ts
// Routes /types/*  : lecture publique (par scope) + CRUD admin.
//
// Ce controller ne contient AUCUNE logique métier.
// Il délègue tout au TypeService.
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

import { TypeService } from '../services/type.service';
import { Public, Roles } from '../../core/decorators/api.decorator';
import { UserRole } from '../../shared/common.enum';
import { TypeScope } from '../type.enum';

// ⚠️ Import de valeur obligatoire (pas `import type`) pour les DTOs utilisés
// avec @Body() — voir la note équivalente sur users/controllers/user.controller.ts.
import { CreateTypeDto, UpdateTypeDto } from '../dto/type.dto';
import type { ListTypeAdminQuery, ListTypePublicQuery } from '../dto/type.dto';

@ApiTags('Types')
@Controller('types')
export class TypeController {
  constructor(private readonly typeService: TypeService) {}

  // ── Public ────────────────────────────────────────────────

  /**
   * GET /types
   * Liste les types actifs, filtrés par scope — alimente les
   * sélecteurs (intention, sacrement, don, publication, horaire).
   */
  @Get()
  @Public()
  @ApiOperation({ summary: 'Lister les types actifs (filtrable par scope)' })
  @ApiQuery({ name: 'scope', required: false, enum: TypeScope })
  listActive(@Query() query: ListTypePublicQuery) {
    return this.typeService.listActive(query);
  }

  // ── Admin — liste ─────────────────────────────────────────

  /**
   * GET /types/admin
   * Liste paginée de tous les types, y compris inactifs.
   * Accessible : admin, engineer.
   *
   * ⚠️ Doit être déclarée AVANT `:id` pour éviter que NestJS
   * interprète "admin" comme un id.
   */
  @Get('admin')
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Lister tous les types (paginé + filtres)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'scope', required: false, enum: TypeScope })
  @ApiQuery({ name: 'active', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false, type: String })
  listAdmin(@Query() query: ListTypeAdminQuery) {
    return this.typeService.listAdmin(query);
  }

  // ── Admin — création ──────────────────────────────────────

  /**
   * POST /types
   * Accessible : admin, engineer.
   */
  @Post()
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Créer un type' })
  create(@Body() body: CreateTypeDto) {
    return this.typeService.create(body);
  }

  // ── Public — détail ───────────────────────────────────────

  /**
   * GET /types/:id
   */
  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Récupérer un type par id' })
  getById(@Param('id') id: string) {
    return this.typeService.getById(id);
  }

  // ── Admin — mise à jour ───────────────────────────────────

  /**
   * PATCH /types/:id
   * Accessible : admin, engineer.
   */
  @Patch(':id')
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Mettre à jour un type' })
  update(@Param('id') id: string, @Body() body: UpdateTypeDto) {
    return this.typeService.update(id, body);
  }

  // ── Admin — suppression ───────────────────────────────────

  /**
   * DELETE /types/:id
   * Accessible : admin uniquement.
   */
  @Delete(':id')
  @Roles(UserRole.admin)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Supprimer un type' })
  delete(@Param('id') id: string) {
    return this.typeService.delete(id);
  }
}
