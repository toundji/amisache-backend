// ============================================================
// UNIFIED AUTH — contact.controller.ts
// Routes /contact/*  : formulaire public + boîte de réception admin.
//
// Ce controller ne contient AUCUNE logique métier.
// Il délègue tout au ContactService.
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

import { ContactService } from '../services/contact.service';
import { AuditInfo, Public, Roles } from '../../core/decorators/api.decorator';
import { ContactMessageStatus, UserRole } from '../../shared/common.enum';

// ⚠️ Import de valeur obligatoire (pas `import type`) pour les DTOs utilisés
// avec @Body() — voir la note équivalente sur users/controllers/user.controller.ts.
import {
  CreateContactMessageDto,
  UpdateContactStatusDto,
} from '../dto/contact.dto';
import type { ListContactMessagesQuery } from '../dto/contact.dto';

@ApiTags('Contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  // ── Formulaire public ──────────────────────────────────────

  /**
   * POST /contact
   * Soumission du formulaire de contact public (site vitrine, landing...).
   * Envoie une notification à l'admin + un accusé de réception à l'expéditeur.
   */
  @Post()
  @Public()
  @ApiOperation({ summary: 'Envoyer un message via le formulaire de contact' })
  create(
    @Body() body: CreateContactMessageDto,
    @AuditInfo() audit: { ip?: string },
  ) {
    return this.contactService.create(body, audit.ip);
  }

  // ── Admin — liste ─────────────────────────────────────────

  /**
   * GET /contact
   * Liste paginée des messages reçus, avec filtres optionnels.
   * Accessible : admin, manager.
   */
  @Get()
  @Roles(UserRole.admin, UserRole.manager)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[Admin] Lister les messages de contact (paginé + filtres)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: ContactMessageStatus })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['createdAt', 'status'] })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  list(@Query() query: ListContactMessagesQuery) {
    return this.contactService.list(query);
  }

  // ── Admin — détail ────────────────────────────────────────

  /**
   * GET /contact/:id
   * Accessible : admin, manager.
   */
  @Get(':id')
  @Roles(UserRole.admin, UserRole.manager)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Récupérer un message de contact par id' })
  getById(@Param('id') id: string) {
    return this.contactService.getById(id);
  }

  // ── Admin — mise à jour statut ────────────────────────────

  /**
   * PATCH /contact/:id/status
   * Marquer un message comme lu / traité, avec note interne optionnelle.
   * Accessible : admin, manager.
   */
  @Patch(':id/status')
  @Roles(UserRole.admin, UserRole.manager)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "[Admin] Changer le statut d'un message de contact",
  })
  updateStatus(@Param('id') id: string, @Body() body: UpdateContactStatusDto) {
    return this.contactService.updateStatus(id, body);
  }

  // ── Admin — suppression ───────────────────────────────────

  /**
   * DELETE /contact/:id
   * Accessible : admin uniquement.
   */
  @Delete(':id')
  @Roles(UserRole.admin)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Supprimer un message de contact' })
  delete(@Param('id') id: string) {
    return this.contactService.delete(id);
  }
}
