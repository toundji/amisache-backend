// ============================================================
// AMISACHE — group.controller.ts
// Routes /groups/*  : lecture publique (filtrée par churchId) + CRUD admin.
//
// Ce controller ne contient AUCUNE logique métier.
// Il délègue tout au GroupService.
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

import { GroupService } from '../services/group.service';
import { GetUser, Public, Roles } from '../../core/decorators/api.decorator';
import { UserRole } from '../../shared/common.enum';
import { JwtUserInfo } from '../../auth/dto/auth.type.dto';

import { CreateGroupDto, UpdateGroupDto } from '../dto/group.dto';
import type { ListGroupQuery } from '../dto/group.dto';

@ApiTags('Community — Groupes')
@Controller('groups')
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  /** GET /groups?churchId=... — liste publique */
  @Get()
  @Public()
  @ApiOperation({ summary: "Lister les groupes d'une église" })
  @ApiQuery({ name: 'churchId', required: true, type: String })
  list(@Query() query: ListGroupQuery) {
    return this.groupService.list(query);
  }

  /**
   * GET /groups/admin — liste complète, toutes églises.
   * ⚠️ Déclarée AVANT `:id`.
   */
  @Get('admin')
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Liste complète des groupes (toutes églises)' })
  listAdmin() {
    return this.groupService.listAdmin();
  }

  /**
   * GET /groups/church/:churchId — groupes d'UNE église.
   * Accès : admin/engineer, ou membre du clergé ACTIF de cette église.
   */
  @Get('church/:churchId')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Liste complète des groupes d'une église (clergé de cette église, ou admin)" })
  listForChurch(@GetUser() user: JwtUserInfo, @Param('churchId') churchId: string) {
    return this.groupService.listForChurch(user, churchId);
  }

  /** GET /groups/:id */
  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Récupérer un groupe par id' })
  getById(@Param('id') id: string) {
    return this.groupService.getById(id);
  }

  /** POST /groups — admin, engineer, ou clergé actif de l'église visée */
  @Post()
  @Roles(UserRole.admin, UserRole.engineer, UserRole.clergy)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Créer un groupe (admin, ou clergé de cette église)' })
  create(@GetUser() user: JwtUserInfo, @Body() body: CreateGroupDto) {
    return this.groupService.create(user, body);
  }

  /** PATCH /groups/:id — admin, engineer, ou clergé actif de l'église visée */
  @Patch(':id')
  @Roles(UserRole.admin, UserRole.engineer, UserRole.clergy)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mettre à jour un groupe (admin, ou clergé de cette église)' })
  update(@GetUser() user: JwtUserInfo, @Param('id') id: string, @Body() body: UpdateGroupDto) {
    return this.groupService.update(user, id, body);
  }

  /** DELETE /groups/:id — admin, engineer, ou clergé actif de l'église visée */
  @Delete(':id')
  @Roles(UserRole.admin, UserRole.engineer, UserRole.clergy)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Supprimer un groupe (admin, ou clergé de cette église)' })
  delete(@GetUser() user: JwtUserInfo, @Param('id') id: string) {
    return this.groupService.delete(user, id);
  }
}
