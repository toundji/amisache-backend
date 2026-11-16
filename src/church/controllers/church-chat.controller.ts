// ============================================================
// AMISACHE — church-chat.controller.ts
// Routes /church-chat/* : ouvrir son fil avec une paroisse (fidèle), lister les fils de la paroisse
// (son clergé actif). Les messages eux-mêmes passent par les routes génériques /chat/conversations/:id/*.
// ============================================================
import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { GetUser } from '../../core/decorators/api.decorator';
import { JwtUserInfo } from '../../auth/dto/auth.type.dto';
import { ChurchChatService } from '../services/church-chat.service';

@ApiTags('Church — Messages')
@ApiBearerAuth()
@Controller('church-chat')
export class ChurchChatController {
  constructor(private readonly churchChatService: ChurchChatService) {}

  @Post(':churchId')
  @ApiOperation({ summary: 'Ouvrir (ou reprendre) mon fil avec cette paroisse' })
  ouvrir(@GetUser() user: JwtUserInfo, @Param('churchId') churchId: string) {
    return this.churchChatService.ouvrir(user, churchId);
  }

  @Get(':churchId/conversations')
  @ApiOperation({ summary: 'Fils des fidèles avec cette paroisse (clergé actif de la paroisse, ou admin)' })
  lister(@GetUser() user: JwtUserInfo, @Param('churchId') churchId: string) {
    return this.churchChatService.listerPourEquipe(user, churchId);
  }
}
