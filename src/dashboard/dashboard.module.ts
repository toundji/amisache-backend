import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Request } from '../liturgy/entities/request.entity';
import { Payment } from '../payment/entities/payment.entity';
import { Publication } from '../community/entities/publication.entity';
import { Church } from '../church/entities/church.entity';
import { ChurchModule } from '../church/church.module';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Request, Payment, Publication, Church]), ChurchModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
