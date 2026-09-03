// ============================================================
// AMISACHE — donation.dto.ts
// DTOs des routes /donations/*.
// ============================================================
import { Type as TransformType } from 'class-transformer';
import { IsUUID, ValidateNested } from 'class-validator';
import { SubmitPaymentDto } from '../../payment/dto/payment.dto';

export class CreateDonationDto {
  @IsUUID()
  churchId!: string;

  /** Doit appartenir au scope DONATION (validé côté service) */
  @IsUUID()
  typeId!: string;

  /** Toujours requis — contrairement à Request, un don porte toujours un paiement */
  @ValidateNested()
  @TransformType(() => SubmitPaymentDto)
  payment!: SubmitPaymentDto;
}

export interface ListDonationQuery {
  churchId?: string;
}
