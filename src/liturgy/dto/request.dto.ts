// ============================================================
// AMISACHE — request.dto.ts
// DTOs des routes /requests/*.
// ============================================================
import { Type as TransformType } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { RequestStatus } from '../liturgy.enum';
import { SubmitPaymentDto } from '../../payment/dto/payment.dto';

export class CreateRequestDto {
  /** Doit être une occurrence valide de `scheduleId` si renseigné (§4.6) */
  @IsDateString()
  date!: string;

  @IsString()
  @IsOptional()
  text?: string;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  offering?: number;

  @IsString()
  @IsOptional()
  attachments?: string;

  @IsUUID()
  churchId!: string;

  /** Quelle messe — combiné à `date`, identifie la célébration exacte */
  @IsUUID()
  @IsOptional()
  scheduleId?: string;

  /** Doit appartenir au scope INTENTION ou SACRAMENT (validé côté service) */
  @IsUUID()
  typeId!: string;

  /** Offrande immédiate — omis si la demande est déposée sans paiement */
  @ValidateNested()
  @TransformType(() => SubmitPaymentDto)
  @IsOptional()
  payment?: SubmitPaymentDto;
}

export class UpdateRequestStatusDto {
  @IsEnum(RequestStatus, { message: 'Statut invalide.' })
  status!: RequestStatus;
}

export interface ListRequestQuery {
  churchId?: string;
  status?: RequestStatus;
}
