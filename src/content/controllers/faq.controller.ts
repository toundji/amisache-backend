// ============================================================
// UNIFIED AUTH — faq.controller.ts
// Routes /faq/*  : lecture publique + CRUD admin.
//
// Ce controller ne contient AUCUNE logique métier.
// Il délègue tout au FaqService.
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

import { FaqService } from '../services/faq.service';
import { Public, Roles } from '../../core/decorators/api.decorator';
import { FaqCategory, UserRole } from '../../shared/common.enum';

// ⚠️ Import de valeur obligatoire (pas `import type`) pour les DTOs utilisés
// avec @Body() — voir la note équivalente sur users/controllers/user.controller.ts.
import { CreateFaqDto, UpdateFaqDto } from '../dto/faq.dto';
import type { ListFaqAdminQuery, ListFaqPublicQuery } from '../dto/faq.dto';

@ApiTags('FAQ')
@Controller('faq')
export class FaqController {
  constructor(private readonly faqService: FaqService) {}

  // ── Public ────────────────────────────────────────────────

  /**
   * GET /faq
   * Liste les FAQ publiées, triées par ordre d'affichage.
   */
  @Get()
  @Public()
  @ApiOperation({ summary: 'Lister les FAQ publiées' })
  @ApiQuery({ name: 'category', required: false, enum: FaqCategory })
  listPublished(@Query() query: ListFaqPublicQuery) {
    return this.faqService.listPublished(query);
  }

  // ── Admin — liste ─────────────────────────────────────────

  /**
   * GET /faq/admin
   * Liste paginée de toutes les FAQ, y compris les brouillons.
   * Accessible : admin, manager.
   *
   * ⚠️ Doit être déclarée AVANT `:id` pour éviter que NestJS
   * interprète "admin" comme un id.
   */
  @Get('admin')
  @Roles(UserRole.admin, UserRole.manager)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Lister toutes les FAQ (paginé + filtres)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'category', required: false, enum: FaqCategory })
  @ApiQuery({ name: 'answered', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false, type: String })
  listAdmin(@Query() query: ListFaqAdminQuery) {
    return this.faqService.listAdmin(query);
  }

  // ── Admin — création ──────────────────────────────────────

  /**
   * POST /faq
   * Accessible : admin, manager.
   */
  @Post()
  @Roles(UserRole.admin, UserRole.manager)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Créer une FAQ' })
  create(@Body() body: CreateFaqDto) {
    return this.faqService.create(body);
  }

  // ── Public — détail ───────────────────────────────────────

  /**
   * GET /faq/:id
   */
  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Récupérer une FAQ par id' })
  getById(@Param('id') id: string) {
    return this.faqService.getById(id);
  }

  // ── Admin — mise à jour ───────────────────────────────────

  /**
   * PATCH /faq/:id
   * Accessible : admin, manager.
   */
  @Patch(':id')
  @Roles(UserRole.admin, UserRole.manager)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Mettre à jour une FAQ' })
  update(@Param('id') id: string, @Body() body: UpdateFaqDto) {
    return this.faqService.update(id, body);
  }

  // ── Admin — suppression ───────────────────────────────────

  /**
   * DELETE /faq/:id
   * Accessible : admin uniquement.
   */
  @Delete(':id')
  @Roles(UserRole.admin)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Supprimer une FAQ' })
  delete(@Param('id') id: string) {
    return this.faqService.delete(id);
  }
}
