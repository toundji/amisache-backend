// ============================================================
// AMISACHE — group-member.controller.ts
// Routes /group-members/*  : self-service fidèle (rejoindre/quitter un
// groupe) + lecture admin des membres d'un groupe.
//
// Ce controller ne contient AUCUNE logique métier.
// Il délègue tout au GroupMemberService.
// ============================================================
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

import { GroupMemberService } from '../services/group-member.service';
import { GetUser, Roles } from '../../core/decorators/api.decorator';
import { UserRole } from '../../shared/common.enum';
import { JwtUserInfo } from '../../auth/dto/auth.type.dto';

import { JoinGroupDto } from '../dto/group-member.dto';

@ApiTags('Community — Membres de groupe')
@Controller('group-members')
export class GroupMemberController {
  constructor(private readonly groupMemberService: GroupMemberService) {}

  /** GET /group-members/me — mes adhésions */
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lister mes adhésions à des groupes' })
  listMine(@GetUser() user: JwtUserInfo) {
    return this.groupMemberService.listMine(user.id);
  }

  /**
   * GET /group-members/admin?groupId=...
   * Accessible : admin, engineer.
   * ⚠️ Doit être déclarée AVANT `:id` pour éviter que NestJS
   * interprète "admin" comme un id.
   */
  @Get('admin')
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: "[Admin] Lister les membres d'un groupe" })
  @ApiQuery({ name: 'groupId', required: true, type: String })
  listForGroup(@Query('groupId') groupId: string) {
    return this.groupMemberService.listForGroup(groupId);
  }

  /** POST /group-members — rejoindre un groupe */
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Rejoindre un groupe' })
  join(@GetUser() user: JwtUserInfo, @Body() body: JoinGroupDto) {
    return this.groupMemberService.join(user.id, body.groupId);
  }

  /** DELETE /group-members/:id — quitter (soi-même, ou admin) */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Quitter un groupe' })
  leave(@GetUser() user: JwtUserInfo, @Param('id') id: string) {
    const isAdmin = [UserRole.admin, UserRole.engineer].some((r) =>
      user.roles?.includes(r),
    );
    return this.groupMemberService.leave(id, user.id, isAdmin);
  }
}
