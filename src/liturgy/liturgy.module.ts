// ============================================================
// AMISACHE — liturgy.module.ts
// Dépend de church/ (Church, ClergyMember indirectement via payment/),
// type/ (scopes SCHEDULE/INTENTION/SACRAMENT/DONATION) et payment/
// (offrande de Request, don de Donation) — jamais l'inverse. Voir
// AMISACHE.md §3.
// ============================================================
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Schedule } from './entities/schedule.entity';
import { Request } from './entities/request.entity';
import { Donation } from './entities/donation.entity';

import { ScheduleService } from './services/schedule.service';
import { RequestService } from './services/request.service';
import { DonationService } from './services/donation.service';

import { ScheduleController } from './controllers/schedule.controller';
import { RequestController } from './controllers/request.controller';
import { DonationController } from './controllers/donation.controller';

import { ChurchModule } from '../church/church.module';
import { TypeModule } from '../type/type.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Schedule, Request, Donation]),
    ChurchModule,
    TypeModule,
    PaymentModule,
  ],
  controllers: [ScheduleController, RequestController, DonationController],
  providers: [ScheduleService, RequestService, DonationService],
  exports: [ScheduleService, RequestService, DonationService],
})
export class LiturgyModule {}
