// ============================================================
// AMISACHE — donation.controller.ts
// Routes /donations/*  : self-service fidèle (donner, consulter les
// siens) + suivi admin.
//
// Ce controller ne contient AUCUNE logique métier.
// Il délègue tout au DonationService.
// ============================================================
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

import { DonationService } from '../services/donation.service';
import { GetUser, Roles } from '../../core/decorators/api.decorator';
import { UserRole } from '../../shared/common.enum';
import { JwtUserInfo } from '../../auth/dto/auth.type.dto';

import { CreateDonationDto } from '../dto/donation.dto';
import type { ListDonationQuery } from '../dto/donation.dto';

@ApiTags('Liturgy — Dons')
@Controller('donations')
export class DonationController {
  constructor(private readonly donationService: DonationService) {}

  /** GET /donations/me — mes dons */
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lister mes dons' })
  listMine(@GetUser() user: JwtUserInfo) {
    return this.donationService.listMine(user.id);
  }

  /**
   * GET /donations/admin?churchId=...
   * Accessible : admin, engineer.
   * ⚠️ Doit être déclarée AVANT `:id` pour éviter que NestJS
   * interprète "admin" comme un id.
   */
  @Get('admin')
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Lister tous les dons (filtrable par église)' })
  @ApiQuery({ name: 'churchId', required: false, type: String })
  listAdmin(@Query() query: ListDonationQuery) {
    return this.donationService.listAdmin(query);
  }

  /** POST /donations — faire un don (paiement toujours requis) */
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Faire un don (paiement déclaratif requis)' })
  create(@GetUser() user: JwtUserInfo, @Body() body: CreateDonationDto) {
    return this.donationService.create(user.id, body);
  }

  /** GET /donations/:id — le donateur lui-même, ou l'admin/engineer */
  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Récupérer un don par id' })
  getById(@GetUser() user: JwtUserInfo, @Param('id') id: string) {
    const isAdmin = [UserRole.admin, UserRole.engineer].some((r) =>
      user.roles?.includes(r),
    );
    return isAdmin
      ? this.donationService.getById(id)
      : this.donationService.getMineById(id, user.id);
  }
}
