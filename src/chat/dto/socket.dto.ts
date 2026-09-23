// ============================================================
// AMISACHE — socket.dto.ts
// Payloads des événements client -> serveur du ChatGateway
// (join/leave/typing). Validés via ValidationPipe, comme les DTO HTTP.
// ============================================================
import { IsBoolean, IsUUID } from 'class-validator';

export class JoinConversationDto {
  @IsUUID()
  conversationId!: string;
}

export class TypingDto {
  @IsUUID()
  conversationId!: string;

  @IsBoolean()
  isTyping!: boolean;
}
