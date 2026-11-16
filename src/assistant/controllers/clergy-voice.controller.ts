// ============================================================
// AMISACHE — clergy-voice.controller.ts
// POST /assistant/clergy/:churchId — commande vocale du clergé (texte déjà dicté par l'app).
// ============================================================
import { Body, Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

import { GetUser, Roles } from '../../core/decorators/api.decorator';
import { JwtUserInfo } from '../../auth/dto/auth.type.dto';
import { UserRole } from '../../shared/common.enum';
import { ClergyVoiceService } from '../services/clergy-voice.service';

/** Un échange précédent (contexte : « et celles de 9 h 30 ? »). */
export class MessageVocalDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  @MaxLength(500)
  texte!: string;
}

export class CommandeVocaleDto {
  @IsString()
  @MaxLength(500)
  texte!: string;

  /** Écran où se trouve le prêtre (contexte). */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  ecran?: string;

  /** Autres transcriptions proposées par la dictée (accents, mots mal entendus), 3 au plus. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  alternatives?: string[];

  /** Les 5 derniers messages au plus (prêtre / assistant), du plus ancien au plus récent. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => MessageVocalDto)
  historique?: MessageVocalDto[];
}

@ApiTags('Assistant — vocal clergé')
@ApiBearerAuth()
@Controller('assistant/clergy')
export class ClergyVoiceController {
  constructor(private readonly voice: ClergyVoiceService) {}

  @Post(':churchId')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.admin, UserRole.engineer, UserRole.clergy)
  @ApiOperation({ summary: "Interpréter une commande vocale du clergé (consulter / naviguer) — l'app exécute l'action renvoyée" })
  interpreter(@GetUser() user: JwtUserInfo, @Param('churchId') churchId: string, @Body() body: CommandeVocaleDto) {
    return this.voice.interpreter(user, churchId, body.texte, body.ecran, body.historique, body.alternatives);
  }
}
