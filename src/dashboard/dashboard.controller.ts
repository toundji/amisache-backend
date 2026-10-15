// ============================================================
// AMISACHE — dashboard.controller.ts
// GET /dashboard/stats — chiffres de l'accueil du panel. Aucune logique
// métier ici : tout est délégué à DashboardService.
// ============================================================
import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { DashboardService } from './dashboard.service';
import { GetUser, Roles } from '../core/decorators/api.decorator';
import { UserRole } from '../shared/common.enum';
import { JwtUserInfo } from '../auth/dto/auth.type.dto';

@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @ApiBearerAuth()
  @Roles(UserRole.admin, UserRole.engineer, UserRole.clergy)
  @ApiOperation({ summary: "Chiffres de l'accueil du panel (plateforme, ou une église avec churchId)" })
  @ApiQuery({ name: 'churchId', required: false, type: String })
  stats(@GetUser() user: JwtUserInfo, @Query('churchId') churchId?: string) {
    return this.dashboardService.stats(user, churchId || undefined);
  }
}
