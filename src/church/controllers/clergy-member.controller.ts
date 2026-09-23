// ============================================================
// AMISACHE — clergy-member.controller.ts
// Routes /clergy-members/*  : lecture publique (le clergé d'une église
// est une info de la page publique) + écriture réservée à l'admin/engineer
// (toute église) ou au clergé ACTIF de l'église visée (délègue la gestion
// de son propre personnel, jamais celui d'une autre église).
//
// Ce controller ne contient AUCUNE logique métier.
// Il délègue tout au ClergyMemberService.
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

import { ClergyMemberService } from '../services/clergy-member.service';
import { GetUser, Public, Roles } from '../../core/decorators/api.decorator';
import { UserRole } from '../../shared/common.enum';
import { JwtUserInfo } from '../../auth/dto/auth.type.dto';

import { CreateClergyMemberDto, UpdateClergyMemberDto } from '../dto/clergy-member.dto';
import type { ListClergyMemberQuery } from '../dto/clergy-member.dto';

@ApiTags('Church — Clergé')
@Controller('clergy-members')
export class ClergyMemberController {
  constructor(private readonly clergyMemberService: ClergyMemberService) {}

  /** GET /clergy-members?churchId=...&userId=...&activeOnly=true — filtres optionnels */
  @Get()
  @Public()
  @ApiOperation({ summary: 'Lister les affectations du clergé/personnel (toutes, pour une église, ou pour un utilisateur)' })
  @ApiQuery({ name: 'churchId', required: false, type: String })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean })
  list(@Query() query: ListClergyMemberQuery) {
    return this.clergyMemberService.list(query);
  }

  /**
   * GET /clergy-members/admin — liste complète, toutes églises.
   * ⚠️ Déclarée AVANT `:id` (sinon NestJS lit "admin" comme un id).
   */
  @Get('admin')
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Liste complète des affectations (toutes églises)' })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean })
  listAdmin(@Query() query: ListClergyMemberQuery) {
    return this.clergyMemberService.listAdmin(query);
  }

  /**
   * GET /clergy-members/church/:churchId — liste complète d'UNE église.
   * Accès : admin/engineer, ou membre du clergé ACTIF de cette église.
   */
  @Get('church/:churchId')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Liste complète des affectations d'une église (clergé de cette église, ou admin)" })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean })
  listForChurch(
    @GetUser() user: JwtUserInfo,
    @Param('churchId') churchId: string,
    @Query() query: ListClergyMemberQuery,
  ) {
    return this.clergyMemberService.listForChurch(user, churchId, query);
  }

  /** GET /clergy-members/:id */
  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Récupérer une affectation par id' })
  getById(@Param('id') id: string) {
    return this.clergyMemberService.getById(id);
  }

  /** POST /clergy-members — admin/engineer (toute église), ou clergé ACTIF de l'église visée */
  @Post()
  @Roles(UserRole.admin, UserRole.engineer, UserRole.clergy)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Affecter un membre du clergé/personnel à une église (admin, ou clergé de cette église)" })
  create(@GetUser() user: JwtUserInfo, @Body() body: CreateClergyMemberDto) {
    return this.clergyMemberService.create(user, body);
  }

  /** PATCH /clergy-members/:id — admin/engineer, ou clergé ACTIF de l'église de cette affectation */
  @Patch(':id')
  @Roles(UserRole.admin, UserRole.engineer, UserRole.clergy)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Mettre à jour une affectation, ex: mettre fin via endDate (admin, ou clergé de cette église)" })
  update(@GetUser() user: JwtUserInfo, @Param('id') id: string, @Body() body: UpdateClergyMemberDto) {
    return this.clergyMemberService.update(user, id, body);
  }

  /** DELETE /clergy-members/:id — admin/engineer, ou clergé ACTIF de l'église de cette affectation */
  @Delete(':id')
  @Roles(UserRole.admin, UserRole.engineer, UserRole.clergy)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Supprimer une affectation (admin, ou clergé de cette église)' })
  delete(@GetUser() user: JwtUserInfo, @Param('id') id: string) {
    return this.clergyMemberService.delete(user, id);
  }
}
