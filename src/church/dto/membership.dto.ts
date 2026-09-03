// ============================================================
// AMISACHE — membership.dto.ts
// DTOs des routes /memberships/*.
// ============================================================
import { IsUUID } from 'class-validator';

export class FollowChurchDto {
  @IsUUID()
  churchId!: string;
}

export class SetHomeChurchDto {
  @IsUUID()
  churchId!: string;
}
