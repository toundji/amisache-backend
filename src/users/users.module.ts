// ============================================================
// users.module.ts
// Agrégat utilisateur : identité, profil, administration des comptes.
// Session/PIN/OTP vivent dans auth/ ; importe AuthModule pour les
// consommer (règle de dépendance : users -> auth, jamais l'inverse).
// ============================================================
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';

import { User } from './entities/user.entity';

import { UserController } from './controllers/user.controller';

import { UserService } from './services/user.service';

@Module({
  imports: [TypeOrmModule.forFeature([User]), AuthModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UsersModule {}
