// ============================================================
// AMISACHE — clergy-member.controller.ts
// Routes /clergy-members/*  : lecture publique (le clergé d'une église
// est une info de la page publique) + gestion réservée à l'admin/engineer
// (affecter/retirer un membre du clergé n'est pas du self-service).
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
import { Public, Roles } from '../../core/decorators/api.decorator';
import { UserRole } from '../../shared/common.enum';

import { CreateClergyMemberDto, UpdateClergyMemberDto } from '../dto/clergy-member.dto';
import type { ListClergyMemberQuery } from '../dto/clergy-member.dto';

@ApiTags('Church — Clergé')
@Controller('clergy-members')
export class ClergyMemberController {
  constructor(private readonly clergyMemberService: ClergyMemberService) {}

  /** GET /clergy-members?churchId=...&activeOnly=true — liste publique */
  @Get()
  @Public()
  @ApiOperation({ summary: 'Lister les affectations du clergé/personnel pour une église' })
  @ApiQuery({ name: 'churchId', required: true, type: String })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean })
  list(@Query() query: ListClergyMemberQuery) {
    return this.clergyMemberService.list(query);
  }

  /** GET /clergy-members/:id */
  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Récupérer une affectation par id' })
  getById(@Param('id') id: string) {
    return this.clergyMemberService.getById(id);
  }

  /** POST /clergy-members — admin, engineer */
  @Post()
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Affecter un membre du clergé/personnel à une église' })
  create(@Body() body: CreateClergyMemberDto) {
    return this.clergyMemberService.create(body);
  }

  /** PATCH /clergy-members/:id — admin, engineer */
  @Patch(':id')
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: "[Admin] Mettre à jour une affectation (ex: mettre fin via endDate)" })
  update(@Param('id') id: string, @Body() body: UpdateClergyMemberDto) {
    return this.clergyMemberService.update(id, body);
  }

  /** DELETE /clergy-members/:id — admin uniquement */
  @Delete(':id')
  @Roles(UserRole.admin)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Supprimer une affectation' })
  delete(@Param('id') id: string) {
    return this.clergyMemberService.delete(id);
  }
}
