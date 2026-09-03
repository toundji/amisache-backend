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
import { Public, Roles } from '../../core/decorators/api.decorator';
import { UserRole } from '../../shared/common.enum';

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

  /** GET /groups/:id */
  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Récupérer un groupe par id' })
  getById(@Param('id') id: string) {
    return this.groupService.getById(id);
  }

  /** POST /groups — admin, engineer */
  @Post()
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Créer un groupe' })
  create(@Body() body: CreateGroupDto) {
    return this.groupService.create(body);
  }

  /** PATCH /groups/:id — admin, engineer */
  @Patch(':id')
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Mettre à jour un groupe' })
  update(@Param('id') id: string, @Body() body: UpdateGroupDto) {
    return this.groupService.update(id, body);
  }

  /** DELETE /groups/:id — admin, engineer */
  @Delete(':id')
  @Roles(UserRole.admin, UserRole.engineer)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Supprimer un groupe' })
  delete(@Param('id') id: string) {
    return this.groupService.delete(id);
  }
}
