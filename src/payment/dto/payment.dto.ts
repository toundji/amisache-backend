// ============================================================
// AMISACHE — payment.dto.ts
// DTOs des routes /payments/* — et bloc réutilisé (nested) par les
// DTOs de création de Request/Donation, qui créent leur Payment en
// même temps qu'elles (voir liturgy/services/*.service.ts).
// ============================================================
import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsPositive, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsFile, MaxFileSize, HasExtension, FileSystemStoredFile } from 'nestjs-form-data';
import { PaymentOperator, PaymentStatus } from '../payment.enum';

/**
 * Reçu de paiement — image OU PDF (capture d'écran de transaction, souvent
 * un PDF pour un reçu bancaire). Dédiée à ce module plutôt que de
 * réutiliser `shared/media.dto.ts::ImageDto` (png/jpg/jpeg uniquement,
 * partagée par d'autres usages — avatar, logo... — qui ne doivent pas
 * accepter un PDF).
 */
export class ReceiptUploadDto {
  @ApiProperty({ required: true, type: 'string', format: 'binary' })
  @IsFile()
  @MaxFileSize(10e6)
  @HasExtension(['png', 'jpg', 'jpeg', 'pdf'])
  image!: FileSystemStoredFile;
}

/**
 * Informations de paiement fournies par le fidèle à la soumission
 * (Donation : toujours requis — Request : optionnel, offrande).
 * Le `Payment` est créé en base avec status=SUBMITTED, jamais un autre
 * statut à la création (§4.7 — seul un ClergyMember confirme/rejette).
 */
export class SubmitPaymentDto {
  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsEnum(PaymentOperator, { message: 'Opérateur de paiement invalide.' })
  operator!: PaymentOperator;

  @IsString()
  @IsNotEmpty()
  reference!: string;

  @IsString()
  @IsNotEmpty()
  receiptImage!: string;

  @IsDateString()
  paidAt!: string;

  @IsUUID()
  paymentMethodId!: string;
}

export class UpdatePaymentStatusDto {
  @IsEnum([PaymentStatus.CONFIRMED, PaymentStatus.REJECTED], {
    message: 'status doit être CONFIRMED ou REJECTED.',
  })
  status!: PaymentStatus.CONFIRMED | PaymentStatus.REJECTED;
}

export interface ListPaymentQuery {
  status?: PaymentStatus;
}
