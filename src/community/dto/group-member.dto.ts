// ============================================================
// AMISACHE — group-member.dto.ts
// DTOs des routes /group-members/*.
// ============================================================
import { IsUUID } from 'class-validator';

export class JoinGroupDto {
  @IsUUID()
  groupId!: string;
}
