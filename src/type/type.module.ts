// ============================================================
// AMISACHE — type.module.ts
// Module fondation — aucune dépendance métier (voir AMISACHE.md §3, §9).
// ============================================================
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Type } from './entities/type.entity';
import { TypeService } from './services/type.service';
import { TypeController } from './controllers/type.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Type])],
  controllers: [TypeController],
  providers: [TypeService],
  exports: [TypeService],
})
export class TypeModule {}
