// ============================================================
// AMISACHE — country.controller.ts
// Routes /countries/*  : lecture publique + CRUD admin.
//
// Ce controller ne contient AUCUNE logique métier.
// Il délègue tout au CountryService.
// ============================================================
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

import { CountryService } from '../services/country.service';
import { Public, Roles } from '../../core/decorators/api.decorator';
import { UserRole } from '../../shared/common.enum';

// ⚠️ Import de valeur obligatoire (pas `import type`) pour les DTOs utilisés
// avec @Body() — voir la note équivalente sur users/controllers/user.controller.ts.
import { CreateCountryDto, UpdateCountryDto } from '../dto/country.dto';
import type { ListCountryQuery } from '../dto/country.dto';

@ApiTags('Adresse — Pays')
@Controller('countries')
export class CountryController {
  constructor(private readonly countryService: CountryService) {}

  /** GET /countries — liste publique (sélecteur pays) */
  @Get()
  @Public()
  @ApiOperation({ summary: 'Lister les pays' })
  @ApiQuery({ name: 'search', required: false, type: String })
  list(@Query() query: ListCountryQuery) {
    return this.countryService.list(query);
  }

  /** GET /countries/:id */
  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Récupérer un pays par id' })
  getById(@Param('id') id: string) {
    return this.countryService.getById(id);
  }

  /** POST /countries — admin, engineer */
  @Post()
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Créer un pays' })
  create(@Body() body: CreateCountryDto) {
    return this.countryService.create(body);
  }

  /** PATCH /countries/:id — admin, engineer */
  @Patch(':id')
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Mettre à jour un pays' })
  update(@Param('id') id: string, @Body() body: UpdateCountryDto) {
    return this.countryService.update(id, body);
  }

  /** DELETE /countries/:id — admin uniquement */
  @Delete(':id')
  @Roles(UserRole.admin)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Supprimer un pays' })
  delete(@Param('id') id: string) {
    return this.countryService.delete(id);
  }
}
