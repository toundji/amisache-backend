// ============================================================
// AMISACHE — payment-method.dto.ts
// DTOs des routes /payment-methods/*.
// ============================================================
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaymentOperator } from '../payment.enum';

export class CreatePaymentMethodDto {
  @IsEnum(PaymentOperator, { message: 'Opérateur de paiement invalide.' })
  operator!: PaymentOperator;

  @IsPhoneNumber(undefined, { message: 'Numéro de téléphone invalide.' })
  phone!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  accountName!: string;

  @IsUUID()
  churchId!: string;
}

export class UpdatePaymentMethodDto {
  @IsEnum(PaymentOperator, { message: 'Opérateur de paiement invalide.' })
  @IsOptional()
  operator?: PaymentOperator;

  @IsPhoneNumber(undefined, { message: 'Numéro de téléphone invalide.' })
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(160)
  accountName?: string;

  @IsBoolean()
  @IsOptional()
  active?: boolean;
}

export interface ListPaymentMethodQuery {
  /**
   * Requis pour la route publique `GET /payment-methods` ; ignoré par
   * `/admin` (toutes églises) et `/church/:churchId` (église dans le path).
   */
  churchId?: string;
  /** Défaut true côté route publique — seules les méthodes actives intéressent le fidèle */
  activeOnly?: boolean;
}
