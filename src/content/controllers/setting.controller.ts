// ============================================================
// UNIFIED AUTH — setting.controller.ts
// Routes /settings/*  : lecture publique (settings publics) + CRUD admin.
//
// Ce controller ne contient AUCUNE logique métier.
// Il délègue tout au SettingService.
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
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';

import { SettingService } from '../services/setting.service';
import { Public, Roles } from '../../core/decorators/api.decorator';
import { UserRole } from '../../shared/common.enum';

// ⚠️ Import de valeur obligatoire (pas `import type`) pour les DTOs utilisés
// avec @Body() — voir la note équivalente sur users/controllers/user.controller.ts.
import { CreateSettingDto, UpdateSettingDto } from '../dto/setting.dto';
import type { ListSettingAdminQuery } from '../dto/setting.dto';

@ApiTags('Settings')
@Controller('settings')
export class SettingController {
  constructor(private readonly settingService: SettingService) {}

  // ── Public ────────────────────────────────────────────────

  /**
   * GET /settings/public
   * Renvoie { KEY: value } pour tous les settings publics, valeurs typées.
   */
  @Get('public')
  @Public()
  @ApiOperation({ summary: 'Récupérer les settings publics { KEY: value }' })
  getPublicMap() {
    return this.settingService.getPublicMap();
  }

  // ── Admin — liste ─────────────────────────────────────────

  /**
   * GET /settings/admin
   * Liste tous les settings (publics + privés). Accessible : admin, manager.
   *
   * ⚠️ Doit être déclarée AVANT `:id` pour éviter que NestJS
   * interprète "admin" comme un id.
   */
  @Get('admin')
  @Roles(UserRole.admin, UserRole.manager)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Lister tous les settings (filtres)' })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  listAdmin(@Query() query: ListSettingAdminQuery) {
    return this.settingService.listAdmin(query);
  }

  // ── Admin — création ──────────────────────────────────────

  /**
   * POST /settings
   * Accessible : admin, manager.
   */
  @Post()
  @Roles(UserRole.admin, UserRole.manager)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Créer un setting' })
  create(@Body() body: CreateSettingDto) {
    return this.settingService.create(body);
  }

  // ── Admin — détail ────────────────────────────────────────

  /**
   * GET /settings/:id
   * Accessible : admin, manager.
   */
  @Get(':id')
  @Roles(UserRole.admin, UserRole.manager)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Récupérer un setting par id' })
  getById(@Param('id') id: string) {
    return this.settingService.getById(id);
  }

  // ── Admin — mise à jour ───────────────────────────────────

  /**
   * PATCH /settings/:id
   * Accessible : admin, manager. Les settings non éditables (isEditable=false)
   * ignorent toute tentative de modification de `value`.
   */
  @Patch(':id')
  @Roles(UserRole.admin, UserRole.manager)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Mettre à jour un setting' })
  update(@Param('id') id: string, @Body() body: UpdateSettingDto) {
    return this.settingService.update(id, body);
  }

  // ── Admin — suppression ───────────────────────────────────

  /**
   * DELETE /settings/:id
   * Accessible : admin uniquement.
   */
  @Delete(':id')
  @Roles(UserRole.admin)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Supprimer un setting' })
  delete(@Param('id') id: string) {
    return this.settingService.delete(id);
  }
}
