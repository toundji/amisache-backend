// ============================================================
// AMISACHE — membership.controller.ts
// Routes /memberships/*  : self-service fidèle (suivre/retirer une
// paroisse, définir sa paroisse de référence) + lecture admin des
// membres d'une église.
//
// Ce controller ne contient AUCUNE logique métier.
// Il délègue tout au MembershipService.
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

import { MembershipService } from '../services/membership.service';
import { GetUser, Roles } from '../../core/decorators/api.decorator';
import { UserRole } from '../../shared/common.enum';
import { JwtUserInfo } from '../../auth/dto/auth.type.dto';

import { FollowChurchDto, SetHomeChurchDto } from '../dto/membership.dto';

@ApiTags('Church — Fidèles')
@Controller('memberships')
export class MembershipController {
  constructor(private readonly membershipService: MembershipService) {}

  /** GET /memberships/me — mes paroisses suivies */
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lister mes paroisses suivies' })
  listMine(@GetUser() user: JwtUserInfo) {
    return this.membershipService.listMine(user.id);
  }

  /**
   * GET /memberships/admin?churchId=...
   * Accessible : admin, engineer.
   * ⚠️ Doit être déclarée AVANT `:id` pour éviter que NestJS
   * interprète "admin" comme un id.
   */
  @Get('admin')
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: "[Admin] Lister les fidèles qui suivent une église" })
  @ApiQuery({ name: 'churchId', required: true, type: String })
  listForChurch(@Query('churchId') churchId: string) {
    return this.membershipService.listForChurch(churchId);
  }

  /** POST /memberships — suivre une paroisse */
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Suivre une paroisse' })
  follow(@GetUser() user: JwtUserInfo, @Body() body: FollowChurchDto) {
    return this.membershipService.follow(user.id, body.churchId);
  }

  /** PATCH /memberships/home-church — définir sa paroisse de référence */
  @Patch('home-church')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Définir ma paroisse de référence (doit déjà être suivie)' })
  setHomeChurch(@GetUser() user: JwtUserInfo, @Body() body: SetHomeChurchDto) {
    return this.membershipService.setHomeChurch(user.id, body.churchId);
  }

  /** DELETE /memberships/:id — retirer un abonnement (soi-même, ou admin) */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retirer un abonnement à une paroisse' })
  unfollow(@GetUser() user: JwtUserInfo, @Param('id') id: string) {
    const isAdmin = [UserRole.admin, UserRole.engineer].some((r) =>
      user.roles?.includes(r),
    );
    return this.membershipService.unfollow(id, user.id, isAdmin);
  }
}
