// ============================================================
// UNIFIED AUTH — auth.controller.ts
// Gère toutes les routes /auth/* (inscription, login, tokens,
// sessions, reset password, PIN mobile).
// ============================================================
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

import { AuthService } from '../services/auth.service';
import { PasswordService } from '../services/password.service';
import { OtpService } from '../services/otp.service';

import {
  Public,
  NoKey,
  AllowStatus,
  GetUser,
  AuditInfo,
} from '../../core/decorators/api.decorator';

import { JwtUserInfo } from '../dto/auth.type.dto';
import { UserStatus } from '../../shared/common.enum';
// ⚠️ RegisterDto DOIT être un import de valeur (pas `import type`) : NestJS
// lit design:paramtypes pour déterminer le metatype de @Body() et décider
// s'il doit valider. `import type` efface la classe du JS émis → le
// paramètre retombe sur `Object` → ValidationPipe.toValidate() le juge non
// validable et SAUTE la validation en silence — même piège sur
// users/controllers/user.controller.ts.
import {
  LoginDto,
  RefreshDto,
  ConfirmEmailDto,
  SendResetOtpDto,
  ConfirmResetOtpDto,
  ResetPasswordDto,
  UpdatePasswordDto,
  SendResetLinkDto,
  ResetFromLinkDto,
  LoginPinDto,
  SetupPinDto,
  ResetPinDto,
  GoogleAuthDto,
  RegisterDto,
} from '../dto/auth.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordService: PasswordService,
    private readonly otpService: OtpService,
  ) {}

  // ── Inscription ──────────────────────────────────────────

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Inscription + envoi OTP confirmation' })
  register(@Body() body: RegisterDto, @AuditInfo() audit: any) {
    return this.authService.register(body, audit);
  }

  // ── Login ─────────────────────────────────────────────────

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login email + password' })
  login(@Body() body: LoginDto, @AuditInfo() audit: any) {
    return this.authService.login(body, audit);
  }

  // ── Refresh token ─────────────────────────────────────────

  @Post('refresh')
  @Public()
  @NoKey()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renouveler les tokens (rotation)' })
  refresh(@Body() body: RefreshDto) {
    return this.authService.refresh(body.refreshToken);
  }

  // ── Logout ────────────────────────────────────────────────

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Déconnecter l'équipement courant" })
  @ApiBearerAuth()
  logout(@GetUser() user: JwtUserInfo) {
    return this.authService.logout(user.id, user.jti, user.deviceFingerprint);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Déconnecter tous les équipements' })
  @ApiBearerAuth()
  logoutAll(@GetUser() user: JwtUserInfo) {
    return this.authService.logoutAll(user.id, user.jti);
  }

  // ── Google Firebase Auth ──────────────────────────────────

  /**
   * Connexion via Google Firebase Auth.
   * Le idToken est obtenu côté mobile via :
   *   FirebaseAuth.instance.currentUser?.getIdToken()
   * Crée le compte automatiquement si l'email n'existe pas encore.
   */
  @Post('google')
  @HttpCode(HttpStatus.OK)
  @Public()
  @ApiOperation({ summary: 'Connexion / inscription via Google Firebase' })
  loginWithGoogle(@Body() body: GoogleAuthDto, @AuditInfo() audit: any) {
    return this.authService.loginWithGoogle(body.idToken, audit, body.fcmToken);
  }

  // ── Confirmation email ────────────────────────────────────

  @Post('confirm-email')
  @HttpCode(HttpStatus.OK)
  @AllowStatus(UserStatus.unverified)
  @ApiOperation({ summary: "Confirmer l'email via OTP" })
  @ApiBearerAuth()
  confirmEmail(@GetUser() user: JwtUserInfo, @Body() body: ConfirmEmailDto) {
    return this.authService.confirmEmail(user.id, body.otp);
  }

  @Post('resend-confirm')
  @HttpCode(HttpStatus.OK)
  @AllowStatus(UserStatus.unverified)
  @ApiOperation({ summary: "Renvoyer l'OTP de confirmation" })
  @ApiBearerAuth()
  resendConfirm(@AuditInfo() audit: any) {
    return this.authService.resendConfirmOtp(audit.user);
  }

  // ── Reset password (OTP flow) ─────────────────────────────

  @Public()
  @Post('send-reset-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Envoyer un OTP de reset password par email' })
  sendResetOtp(@Body() body: SendResetOtpDto) {
    return this.passwordService.sendResetOtp(body.email);
  }

  @Public()
  @Post('confirm-reset-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Vérifier l'OTP → retourne un tempToken (10min)" })
  confirmResetOtp(@Body() body: ConfirmResetOtpDto) {
    return this.passwordService.confirmResetOtp(body.email, body.otp);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Appliquer le nouveau mot de passe via tempToken' })
  resetPassword(@Body() body: ResetPasswordDto) {
    return this.passwordService.resetPassword(body.tempToken, body.newPassword);
  }

  @Post('update-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Changer son mot de passe (utilisateur connecté)' })
  @ApiBearerAuth()
  updatePassword(
    @GetUser() user: JwtUserInfo,
    @Body() body: UpdatePasswordDto,
  ) {
    return this.passwordService.updatePassword(
      user.id,
      body.oldPassword,
      body.newPassword,
    );
  }

  // ── Sessions multi-équipements (like Telegram) ────────────

  @Get('sessions')
  @ApiOperation({ summary: 'Lister ses équipements connectés' })
  @ApiBearerAuth()
  getSessions(@GetUser() user: JwtUserInfo) {
    return this.authService.getSessions(user.id);
  }

  @Delete('sessions/:id')
  @ApiOperation({ summary: 'Révoquer un équipement spécifique' })
  @ApiBearerAuth()
  revokeSession(@GetUser() user: JwtUserInfo, @Param('id') sessionId: string) {
    return this.authService.revokeSession(user.id, sessionId);
  }

  // ── Web uniquement — reset via lien email ─────────────────

  @Public()
  @Post('send-reset-link')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Envoyer un lien de reset par email (TTL 2h) — Web uniquement',
  })
  sendResetLink(@Body() body: SendResetLinkDto) {
    return this.passwordService.sendResetLink(body.email);
  }

  @Public()
  @Post('reset-from-link')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset via lien email chiffré AES-GCM — Web uniquement',
  })
  resetFromLink(@Body() body: ResetFromLinkDto) {
    return this.passwordService.resetPasswordFromLink(
      body.token,
      body.newPassword,
    );
  }

  // ── Mobile uniquement — PIN ───────────────────────────────

  @Public()
  @Post('login-pin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login par PIN — Mobile uniquement',
    description:
      'Utilisé uniquement si le refresh token est absent (nouveau téléphone / réinstallation). ' +
      'Flow normal : PIN déchiffre le refresh token localement → POST /auth/refresh (aucun appel de cette route).',
  })
  loginWithPin(@Body() body: LoginPinDto, @AuditInfo() audit: any) {
    return this.authService.loginWithPin(body, audit);
  }

  @Post('setup-pin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Configurer ou modifier le PIN — Mobile uniquement',
  })
  @ApiBearerAuth()
  setupPin(@GetUser() user: JwtUserInfo, @Body() body: SetupPinDto) {
    return this.passwordService.setupPin(user.id, body.pinCode);
  }

  @Post('remove-pin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Supprimer le PIN — Mobile uniquement' })
  @ApiBearerAuth()
  removePin(@GetUser() user: JwtUserInfo) {
    return this.passwordService.removePin(user.id);
  }

  @Post('reset-pin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset PIN via OTP email — Mobile uniquement' })
  @ApiBearerAuth()
  resetPin(@GetUser() user: JwtUserInfo, @Body() body: ResetPinDto) {
    return this.passwordService.resetPin(user.id, body.otp, body.newPin);
  }

  @Get('has-pin')
  @ApiOperation({
    summary: 'Vérifier si un PIN est configuré — Mobile uniquement',
  })
  @ApiBearerAuth()
  hasPin(@GetUser() user: JwtUserInfo) {
    return this.passwordService.hasPinConfigured(user.id);
  }

  @Post('send-pin-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Envoyer un OTP pour reset du PIN — Mobile uniquement',
  })
  @ApiBearerAuth()
  sendPinOtp(@AuditInfo() audit: any) {
    // sendPinOtp attend un User complet — récupéré depuis le contexte d'audit
    return this.otpService.sendPinOtp(audit.user);
  }
}
