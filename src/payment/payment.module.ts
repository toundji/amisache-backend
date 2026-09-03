// ============================================================
// AMISACHE — payment.module.ts
// Dépend de church/ (PaymentMethod.church, ClergyMember pour la
// confirmation) — jamais l'inverse. Voir AMISACHE.md §3.
// ============================================================
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PaymentMethod } from './entities/payment-method.entity';
import { Payment } from './entities/payment.entity';

import { PaymentMethodService } from './services/payment-method.service';
import { PaymentService } from './services/payment.service';

import { PaymentMethodController } from './controllers/payment-method.controller';
import { PaymentController } from './controllers/payment.controller';

import { ChurchModule } from '../church/church.module';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentMethod, Payment]), ChurchModule],
  controllers: [PaymentMethodController, PaymentController],
  providers: [PaymentMethodService, PaymentService],
  exports: [PaymentMethodService, PaymentService],
})
export class PaymentModule {}
