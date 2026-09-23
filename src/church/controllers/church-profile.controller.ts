// ============================================================
// AMISACHE — church-profile.controller.ts
// Routes /church-profiles/*  : lecture publique (fiche paroisse) + édition
// par le clergé de cette église (ou admin).
//
// Ce controller ne contient AUCUNE logique métier.
// Il délègue tout au ChurchProfileService.
// ============================================================
import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

import { ChurchProfileService } from '../services/church-profile.service';
import { GetUser, Public, Roles } from '../../core/decorators/api.decorator';
import { UserRole } from '../../shared/common.enum';
import { JwtUserInfo } from '../../auth/dto/auth.type.dto';
import { UpsertChurchProfileDto } from '../dto/church-profile.dto';

@ApiTags('Church — Présentation')
@Controller('church-profiles')
export class ChurchProfileController {
  constructor(private readonly churchProfileService: ChurchProfileService) {}

  /** GET /church-profiles/church/:churchId — public, `null` si rien publié. */
  @Get('church/:churchId')
  @Public()
  @ApiOperation({ summary: "Récupérer le contenu de présentation d'une église" })
  getForChurch(@Param('churchId') churchId: string) {
    return this.churchProfileService.getForChurch(churchId);
  }

  /**
   * PATCH /church-profiles/church/:churchId — admin, engineer, ou clergé
   * actif de cette église. Crée le profil au premier appel, le met à jour
   * ensuite (upsert — un seul profil par église).
   */
  @Patch('church/:churchId')
  @Roles(UserRole.admin, UserRole.engineer, UserRole.clergy)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Publier/mettre à jour la présentation d'une église (admin, ou clergé de cette église)" })
  upsertForChurch(
    @GetUser() user: JwtUserInfo,
    @Param('churchId') churchId: string,
    @Body() body: UpsertChurchProfileDto,
  ) {
    return this.churchProfileService.upsertForChurch(user, churchId, body);
  }
}
