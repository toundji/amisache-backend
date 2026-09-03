// ============================================================
// AMISACHE — payment-method.controller.ts
// Routes /payment-methods/*  : lecture publique (le fidèle doit voir où
// payer) + gestion admin.
//
// Ce controller ne contient AUCUNE logique métier.
// Il délègue tout au PaymentMethodService.
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

import { PaymentMethodService } from '../services/payment-method.service';
import { Public, Roles } from '../../core/decorators/api.decorator';
import { UserRole } from '../../shared/common.enum';

import { CreatePaymentMethodDto, UpdatePaymentMethodDto } from '../dto/payment-method.dto';
import type { ListPaymentMethodQuery } from '../dto/payment-method.dto';

@ApiTags('Payment — Méthodes')
@Controller('payment-methods')
export class PaymentMethodController {
  constructor(private readonly paymentMethodService: PaymentMethodService) {}

  /** GET /payment-methods?churchId=... — liste publique (actives par défaut) */
  @Get()
  @Public()
  @ApiOperation({ summary: "Lister les moyens de paiement d'une église" })
  @ApiQuery({ name: 'churchId', required: true, type: String })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean })
  list(@Query() query: ListPaymentMethodQuery) {
    return this.paymentMethodService.list(query);
  }

  /** GET /payment-methods/:id */
  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Récupérer un moyen de paiement par id' })
  getById(@Param('id') id: string) {
    return this.paymentMethodService.getById(id);
  }

  /** POST /payment-methods — admin, engineer */
  @Post()
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Publier un moyen de paiement pour une église' })
  create(@Body() body: CreatePaymentMethodDto) {
    return this.paymentMethodService.create(body);
  }

  /** PATCH /payment-methods/:id — admin, engineer */
  @Patch(':id')
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Mettre à jour un moyen de paiement' })
  update(@Param('id') id: string, @Body() body: UpdatePaymentMethodDto) {
    return this.paymentMethodService.update(id, body);
  }

  /** DELETE /payment-methods/:id — admin, engineer */
  @Delete(':id')
  @Roles(UserRole.admin, UserRole.engineer)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Supprimer un moyen de paiement' })
  delete(@Param('id') id: string) {
    return this.paymentMethodService.delete(id);
  }
}
