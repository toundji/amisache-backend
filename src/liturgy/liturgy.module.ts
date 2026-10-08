// ============================================================
// AMISACHE — liturgy.module.ts
// Dépend de church/ (Church, ClergyMember indirectement via payment/),
// type/ (scopes SCHEDULE/DONATION — INTENTION/SACRAMENT sortis dans
// request_types, table propre à ce module, 2026-09-26) et payment/
// (offrande de Request, don de Donation) — jamais l'inverse. Voir
// AMISACHE.md §3.
// ============================================================
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Schedule } from './entities/schedule.entity';
import { Request } from './entities/request.entity';
import { Donation } from './entities/donation.entity';
import { Tariff } from './entities/tariff.entity';
import { RequestType } from './entities/request-type.entity';

import { ScheduleService } from './services/schedule.service';
import { RequestService } from './services/request.service';
import { DonationService } from './services/donation.service';
import { TariffService } from './services/tariff.service';
import { RequestTypeService } from './services/request-type.service';

import { ScheduleController } from './controllers/schedule.controller';
import { RequestController } from './controllers/request.controller';
import { DonationController } from './controllers/donation.controller';
import { TariffController } from './controllers/tariff.controller';
import { RequestTypeController } from './controllers/request-type.controller';

import { ChurchModule } from '../church/church.module';
import { TypeModule } from '../type/type.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Schedule, Request, Donation, Tariff, RequestType]),
    ChurchModule,
    TypeModule,
    PaymentModule,
  ],
  controllers: [ScheduleController, RequestController, DonationController, TariffController, RequestTypeController],
  providers: [ScheduleService, RequestService, DonationService, TariffService, RequestTypeService],
  exports: [ScheduleService, RequestService, DonationService, TariffService, RequestTypeService],
})
export class LiturgyModule {}
