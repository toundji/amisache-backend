// ============================================================
// AMISACHE — church.module.ts
// Racine multi-tenant. Dépend de address/ (Country pour le niveau
// CONFERENCE, Address embarqué) et users/ (ClergyMember.user) — jamais
// l'inverse (AMISACHE.md §3, §7.1).
// ============================================================
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Church } from './entities/church.entity';
import { Entrance } from './entities/entrance.entity';
import { ClergyMember } from './entities/clergy-member.entity';
import { Membership } from './entities/membership.entity';

import { ChurchService } from './services/church.service';
import { EntranceService } from './services/entrance.service';
import { ClergyMemberService } from './services/clergy-member.service';
import { MembershipService } from './services/membership.service';

import { ChurchController } from './controllers/church.controller';
import { EntranceController } from './controllers/entrance.controller';
import { ClergyMemberController } from './controllers/clergy-member.controller';
import { MembershipController } from './controllers/membership.controller';

import { AddressModule } from '../address/address.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Church, Entrance, ClergyMember, Membership]),
    AddressModule,
    UsersModule,
  ],
  controllers: [
    ChurchController,
    EntranceController,
    ClergyMemberController,
    MembershipController,
  ],
  providers: [ChurchService, EntranceService, ClergyMemberService, MembershipService],
  exports: [ChurchService, EntranceService, ClergyMemberService, MembershipService],
})
export class ChurchModule {}
