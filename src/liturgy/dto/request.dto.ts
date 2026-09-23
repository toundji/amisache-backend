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
import { ApiProperty } from '@nestjs/swagger';
import { IsFile, MaxFileSize, HasExtension, FileSystemStoredFile } from 'nestjs-form-data';
import { RequestStatus } from '../liturgy.enum';
import { SubmitPaymentDto } from '../../payment/dto/payment.dto';
import { LocationDto } from '../../address/dto/address.dto';

/**
 * Pièce jointe libre d'une demande — une prière, un contenu spécifique à
 * transmettre à la paroisse (image OU PDF), distincte du reçu de paiement
 * (`payment/dto/payment.dto.ts::ReceiptUploadDto`, sémantique différente).
 */
export class RequestAttachmentUploadDto {
  @ApiProperty({ required: true, type: 'string', format: 'binary' })
  @IsFile()
  @MaxFileSize(10e6)
  @HasExtension(['png', 'jpg', 'jpeg', 'pdf'])
  attachment!: FileSystemStoredFile;
}

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

  /** Adresse libre du domicile — présente seulement si la célébration a lieu
   *  à domicile plutôt qu'à l'église (n'importe quel motif peut être demandé
   *  à domicile, ce n'est pas un Type à part). */
  @IsString()
  @IsOptional()
  homeAddress?: string;

  /** Position GPS optionnelle du domicile — best-effort, jamais requise */
  @ValidateNested()
  @TransformType(() => LocationDto)
  @IsOptional()
  homeLocation?: LocationDto;

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
