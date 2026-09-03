// ============================================================
// auth.module.ts
// Flux d'authentification + sécurité de compte : sessions
// multi-équipements, OTP, PIN, reset password, notifications FCM.
// N'importe jamais UsersModule — s'enregistre lui-même dans
// TypeOrmModule.forFeature([User, ...]) en import**ant** la classe
// User de users/entities (règle de dépendance : users -> auth).
// ============================================================
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailModule } from '../mail/mail.module';
import { User } from '../users/entities/user.entity';
import { AuthController } from './controllers/auth.controller';
import { UserDevice } from './entities/user-device.entity';
import { UserSession } from './entities/user-session.entity';
import { AuthService } from './services/auth.service';
import { NotificationService } from './services/notification.service';
import { OtpService } from './services/otp.service';
import { PasswordService } from './services/password.service';
import { SessionService } from './services/session.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserDevice, UserSession]),
    MailModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    NotificationService,
    OtpService,
    SessionService,
    PasswordService,
  ],
  exports: [SessionService, PasswordService],
})
export class AuthModule {}
