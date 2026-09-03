// ============================================================
// UNIFIED AUTH — mail.controller.ts
// Routes admin pour inspecter et relancer les emails échoués.
// Accessible uniquement aux rôles admin / engineer.
// ============================================================
import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

import { MailFailedService } from './mail-failed.service';
import { MailFailedStatus } from './entities/mail-failed.entity';
import { Roles, RequireClientType } from '../core/decorators/api.decorator';
import { ApiClientType, UserRole } from '../shared/common.enum';

@ApiTags('Mail')
@Controller('mail')
@RequireClientType(ApiClientType.back_office)
export class MailController {

    constructor(private readonly mailFailedService: MailFailedService) { }

    /**
     * GET /mail/failed
     * Liste les emails échoués, filtrable par status.
     */
    @Get('failed')
    @Roles(UserRole.admin, UserRole.engineer)
    @ApiBearerAuth()
    @ApiOperation({ summary: '[Admin] Lister les emails échoués' })
    @ApiQuery({ name: 'status', required: false, enum: MailFailedStatus })
    list(@Query('status') status?: MailFailedStatus) {
        return this.mailFailedService.list(status);
    }

    /**
     * POST /mail/failed/:id/retry
     * Remet un email échoué dans la queue pour une nouvelle tentative.
     */
    @Post('failed/:id/retry')
    @Roles(UserRole.admin, UserRole.engineer)
    @HttpCode(HttpStatus.OK)
    @ApiBearerAuth()
    @ApiOperation({ summary: '[Admin] Relancer un email échoué' })
    retry(@Param('id') id: string) {
        return this.mailFailedService.retry(id);
    }

    /**
     * DELETE /mail/failed/:id
     * Marque un email échoué comme abandonné (pas de suppression DB).
     */
    @Delete('failed/:id')
    @Roles(UserRole.admin, UserRole.engineer)
    @HttpCode(HttpStatus.OK)
    @ApiBearerAuth()
    @ApiOperation({ summary: "[Admin] Abandonner un email échoué" })
    abandon(@Param('id') id: string) {
        return this.mailFailedService.abandon(id);
    }
}
