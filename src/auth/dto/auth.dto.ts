// ============================================================
// UNIFIED AUTH — auth.dto.ts
// DTOs des routes /auth/* + types de retour des services auth.
//
// Conventions :
//   • class     → DTO d'entrée HTTP (validable par class-validator)
//   • interface → type de retour ou contrat interne
//
// ⚠️ Piège class-validator : un décorateur comme @IsEmail()/@IsString()
// seul est SILENCIEUSEMENT IGNORÉ quand la valeur est `undefined` (clé
// absente du JSON) — ce n'est pas un no-op sur "optionnel", c'est un
// bug latent : la valeur `undefined` traverse la validation et va
// crasher plus loin (ex: TypeORM `where: { email: undefined }`).
// Tout champ requis DOIT donc porter @IsNotEmpty() (ou @IsDefined())
// en plus de son validateur de forme — jamais l'un sans l'autre.
// ============================================================

import {
  IsEmail,
  IsString,
  IsNotEmpty,
  IsOptional,
  MinLength,
  Length,
  Matches,
  IsUUID,
  IsArray,
} from 'class-validator';
import { ApiClientType } from '../../shared/common.enum';
import { User } from '../../users/entities/user.entity';

// ── Inscription / Login ───────────────────────────────────────

export class RegisterDto {
  @IsNotEmpty({ message: "L'email est requis." })
  @IsEmail({}, { message: 'Email invalide.' })
  email!: string;

  @IsNotEmpty({ message: 'Le mot de passe est requis.' })
  @IsString()
  @MinLength(8, {
    message: 'Le mot de passe doit contenir au moins 8 caractères.',
  })
  password!: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  [key: string]: any;
}

export class LoginDto {
  @IsNotEmpty({ message: "L'email est requis." })
  @IsEmail({}, { message: 'Email invalide.' })
  username!: string; // email

  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe est requis.' })
  password!: string;

  @IsString()
  @IsOptional()
  fcmToken?: string; // mobile uniquement
}

// ── Tokens ────────────────────────────────────────────────────

export class RefreshDto {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

// ── Confirmation email ────────────────────────────────────────

export class ConfirmEmailDto {
  @IsNotEmpty({ message: "L'OTP est requis." })
  @IsString()
  @Length(6, 6, { message: "L'OTP doit contenir exactement 6 chiffres." })
  otp!: string;
}

// ── Reset password (flow OTP) ─────────────────────────────────

export class SendResetOtpDto {
  @IsNotEmpty({ message: "L'email est requis." })
  @IsEmail({}, { message: 'Email invalide.' })
  email!: string;
}

export class ConfirmResetOtpDto {
  @IsNotEmpty({ message: "L'email est requis." })
  @IsEmail({}, { message: 'Email invalide.' })
  email!: string;

  @IsNotEmpty({ message: "L'OTP est requis." })
  @IsString()
  @Length(6, 6, { message: "L'OTP doit contenir exactement 6 chiffres." })
  otp!: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  tempToken!: string;

  @IsNotEmpty({ message: 'Le mot de passe est requis.' })
  @IsString()
  @MinLength(8, {
    message: 'Le mot de passe doit contenir au moins 8 caractères.',
  })
  newPassword!: string;
}

export class UpdatePasswordDto {
  @IsString()
  @IsNotEmpty()
  oldPassword!: string;

  @IsNotEmpty({ message: 'Le mot de passe est requis.' })
  @IsString()
  @MinLength(8, {
    message: 'Le mot de passe doit contenir au moins 8 caractères.',
  })
  newPassword!: string;
}

// ── Reset password (flow lien — Web uniquement) ───────────────

export class SendResetLinkDto {
  @IsNotEmpty({ message: "L'email est requis." })
  @IsEmail({}, { message: 'Email invalide.' })
  email!: string;
}

export class ResetFromLinkDto {
  @IsString()
  @IsNotEmpty()
  token!: string; // token AES-GCM préfixé "rpt_"

  @IsNotEmpty({ message: 'Le mot de passe est requis.' })
  @IsString()
  @MinLength(8, {
    message: 'Le mot de passe doit contenir au moins 8 caractères.',
  })
  newPassword!: string;
}

// ── PIN (Mobile uniquement) ───────────────────────────────────

export class LoginPinDto {
  @IsNotEmpty({ message: 'userId est requis.' })
  @IsUUID('4', { message: 'userId invalide.' })
  userId!: string;

  @IsNotEmpty({ message: 'Le PIN est requis.' })
  @Matches(/^\d{4,6}$/, {
    message: 'Le PIN doit contenir entre 4 et 6 chiffres.',
  })
  pinCode!: string;

  @IsString()
  @IsOptional()
  fcmToken?: string;
}

export class SetupPinDto {
  @IsNotEmpty({ message: 'Le PIN est requis.' })
  @Matches(/^\d{4,6}$/, {
    message: 'Le PIN doit contenir entre 4 et 6 chiffres.',
  })
  pinCode!: string;
}

export class ResetPinDto {
  @IsNotEmpty({ message: "L'OTP est requis." })
  @IsString()
  @Length(6, 6, { message: "L'OTP doit contenir exactement 6 chiffres." })
  otp!: string;

  @IsNotEmpty({ message: 'Le nouveau PIN est requis.' })
  @Matches(/^\d{4,6}$/, {
    message: 'Le PIN doit contenir entre 4 et 6 chiffres.',
  })
  newPin!: string;
}

// ── Google Firebase Auth ──────────────────────────────────────

export class GoogleAuthDto {
  /**
   * idToken retourné par Firebase Auth SDK côté mobile/web.
   * Obtenu après : FirebaseAuth.instance.currentUser?.getIdToken()
   */
  @IsString()
  @IsNotEmpty()
  idToken!: string;

  @IsString()
  @IsOptional()
  fcmToken?: string;
}

// ── Types de retour des services auth ─────────────────────────

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: Partial<User>;
}

export interface UserAuditInfo {
  ip?: string;
  device?: string;
  userAgent?: string;
  clientType?: ApiClientType;
  user?: any;
}
