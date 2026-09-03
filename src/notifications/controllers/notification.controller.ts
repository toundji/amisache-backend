// ============================================================
// UNIFIED AUTH — notification.controller.ts
// Routes /notifications/* — sous les guards globaux (RequireAuthGuard).
// Ce controller ne contient AUCUNE logique métier, il délègue au service.
// ============================================================
import { Controller, Delete, Get, Param, Patch, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { NotificationService } from '../services/notification.service';
import { GetUser } from '../../core/decorators/api.decorator';
import { JwtUserInfo } from '../../auth/dto/auth.type.dto';
import type { ListNotificationsQuery } from '../dto/notification.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * GET /notifications
   * Liste fusionnée (ciblées + groupe) de l'utilisateur courant, paginée.
   */
  @Get()
  @ApiOperation({ summary: 'Lister mes notifications' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  list(@GetUser() user: JwtUserInfo, @Query() query: ListNotificationsQuery) {
    return this.notificationService.findForUser(user.id, query);
  }

  /**
   * GET /notifications/unread-count
   * ⚠️ Doit être déclarée avant `:id` pour éviter que NestJS
   * interprète "unread-count" comme un id.
   */
  @Get('unread-count')
  @ApiOperation({ summary: 'Nombre de notifications non lues' })
  unreadCount(@GetUser() user: JwtUserInfo) {
    return this.notificationService.getUnreadCount(user.id);
  }

  /** PATCH /notifications/read-all */
  @Patch('read-all')
  @ApiOperation({ summary: 'Marquer toutes mes notifications comme lues' })
  markAllRead(@GetUser() user: JwtUserInfo) {
    return this.notificationService.markAllRead(user.id);
  }

  /** PATCH /notifications/:id/read */
  @Patch(':id/read')
  @ApiOperation({ summary: 'Marquer une notification comme lue' })
  markRead(@GetUser() user: JwtUserInfo, @Param('id') id: string) {
    return this.notificationService.markRead(user.id, id);
  }

  /**
   * DELETE /notifications/:id
   * Ciblée -> suppression. Groupe -> dismiss (NotificationState.dismissedAt).
   */
  @Delete(':id')
  @ApiOperation({
    summary: 'Supprimer (ciblée) ou masquer (groupe) une notification',
  })
  remove(@GetUser() user: JwtUserInfo, @Param('id') id: string) {
    return this.notificationService.removeOrDismiss(user.id, id);
  }
}
