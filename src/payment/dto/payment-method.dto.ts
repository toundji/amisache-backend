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
  /** Obligatoire côté service — une méthode de paiement référence toujours son église */
  churchId: string;
  /** Défaut true côté service — seules les méthodes actives intéressent le fidèle */
  activeOnly?: boolean;
}
