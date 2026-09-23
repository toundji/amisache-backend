// ============================================================
// AMISACHE — guest.dto.ts
// DTOs des routes publiques /chat/guest/* (visiteur anonyme, widget de
// la bulle) — jamais de JWT, l'identité est un UUID généré côté client
// et persisté en local (voir amisache-client, ChatWidgetService).
// ============================================================
import { IsString, IsUUID, MinLength } from 'class-validator';

export class OpenGuestConversationDto {
  @IsUUID()
  guestId!: string;
}

export class SendGuestMessageDto {
  @IsUUID()
  guestId!: string;

  @IsString()
  @MinLength(1)
  body!: string;
}

export interface ListGuestMessagesQuery {
  guestId: string;
  page?: number;
  limit?: number;
}
