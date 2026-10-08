// ============================================================
// UNIFIED AUTH — api-error.controller.ts
// Consultation/suppression des 5xx tracés (ApiErrorLogService).
// ============================================================
import { Controller, Delete, Get, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

import { ApiErrorLogService } from '../services/api-error-log.service';
import { ListApiErrorsQuery } from '../dto/api-error.dto';
import { Public, NoKey, Roles } from '../decorators/api.decorator';
import { UserRole } from '../../shared/common.enum';
import { ApiError } from '../../utils/api-error';

@ApiTags('Erreurs')
@Controller('api-errors')
export class ApiErrorController {
  constructor(private readonly errorLog: ApiErrorLogService) {}

  // ── Panel (admin/engineer) ──────────────────────────────────

  @Get('admin')
  @ApiBearerAuth()
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiOperation({ summary: '[Admin] Liste paginée des erreurs 5xx tracées.' })
  list(@Query() query: ListApiErrorsQuery) {
    return this.errorLog.list(query);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiOperation({ summary: '[Admin] Supprime une erreur — une fois corrigée.' })
  delete(@Param('id') id: string) {
    return this.errorLog.delete(id);
  }

  // ── Accès sans compte, réservé (jeton secret) ───────────────
  // Pensé pour être consulté par un outil externe (ex. Claude Code) sans
  // exposer le compte admin ni la clé API — un jeton dédié, distinct des
  // deux, à ne jamais committer (voir .env.example : CLAUDE_ERRORS_TOKEN).
  // Lecture seule : la suppression reste réservée aux routes admin ci-dessus.

  @Get('public')
  @Public()
  @NoKey()
  @ApiOperation({ summary: 'Lecture seule, jeton secret (CLAUDE_ERRORS_TOKEN) requis.' })
  listPublic(@Query() query: ListApiErrorsQuery & { token?: string }) {
    const expected = process.env.CLAUDE_ERRORS_TOKEN;
    if (!expected || query.token !== expected) {
      // Message volontairement vague — ne pas confirmer si CLAUDE_ERRORS_TOKEN existe.
      throw new ApiError('Not found.', { code: HttpStatus.NOT_FOUND, shouldLog: false });
    }
    return this.errorLog.list(query);
  }
}
