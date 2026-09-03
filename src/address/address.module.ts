// ============================================================
// AMISACHE — address.module.ts
// Module fondation — aucune dépendance métier (voir AMISACHE.md §3, §9).
// Country → Region → Zone → Village + objet-valeur Address (embarqué,
// pas de TypeOrmModule.forFeature dédié — voir entities/address.embeddable.ts).
// ============================================================
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Country } from './entities/country.entity';
import { Region } from './entities/region.entity';
import { Zone } from './entities/zone.entity';
import { Village } from './entities/village.entity';

import { CountryService } from './services/country.service';
import { RegionService } from './services/region.service';
import { ZoneService } from './services/zone.service';
import { VillageService } from './services/village.service';

import { CountryController } from './controllers/country.controller';
import { RegionController } from './controllers/region.controller';
import { ZoneController } from './controllers/zone.controller';
import { VillageController } from './controllers/village.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Country, Region, Zone, Village])],
  controllers: [
    CountryController,
    RegionController,
    ZoneController,
    VillageController,
  ],
  providers: [CountryService, RegionService, ZoneService, VillageService],
  exports: [CountryService, RegionService, ZoneService, VillageService],
})
export class AddressModule {}
