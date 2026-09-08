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
import { GetUser, Public, Roles } from '../../core/decorators/api.decorator';
import { UserRole } from '../../shared/common.enum';
import { JwtUserInfo } from '../../auth/dto/auth.type.dto';

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

  /**
   * GET /payment-methods/admin — liste complète, toutes églises.
   * ⚠️ Déclarée AVANT `:id`.
   */
  @Get('admin')
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Liste complète des moyens de paiement (toutes églises)' })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean })
  listAdmin(@Query() query: ListPaymentMethodQuery) {
    return this.paymentMethodService.listAdmin(query);
  }

  /**
   * GET /payment-methods/church/:churchId — moyens de paiement d'UNE église.
   * Accès : admin/engineer, ou membre du clergé ACTIF de cette église.
   */
  @Get('church/:churchId')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Liste complète des moyens de paiement d'une église (clergé de cette église, ou admin)" })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean })
  listForChurch(
    @GetUser() user: JwtUserInfo,
    @Param('churchId') churchId: string,
    @Query() query: ListPaymentMethodQuery,
  ) {
    return this.paymentMethodService.listForChurch(user, churchId, query);
  }

  /** GET /payment-methods/:id */
  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Récupérer un moyen de paiement par id' })
  getById(@Param('id') id: string) {
    return this.paymentMethodService.getById(id);
  }

  /** POST /payment-methods — admin, engineer, ou clergé actif de l'église visée */
  @Post()
  @Roles(UserRole.admin, UserRole.engineer, UserRole.clergy)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Publier un moyen de paiement pour une église (admin, ou clergé de cette église)',
  })
  create(@GetUser() user: JwtUserInfo, @Body() body: CreatePaymentMethodDto) {
    return this.paymentMethodService.create(user, body);
  }

  /** PATCH /payment-methods/:id — admin, engineer, ou clergé actif de l'église visée */
  @Patch(':id')
  @Roles(UserRole.admin, UserRole.engineer, UserRole.clergy)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mettre à jour un moyen de paiement (admin, ou clergé de cette église)' })
  update(
    @GetUser() user: JwtUserInfo,
    @Param('id') id: string,
    @Body() body: UpdatePaymentMethodDto,
  ) {
    return this.paymentMethodService.update(user, id, body);
  }

  /** DELETE /payment-methods/:id — admin, engineer, ou clergé actif de l'église visée */
  @Delete(':id')
  @Roles(UserRole.admin, UserRole.engineer, UserRole.clergy)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Supprimer un moyen de paiement (admin, ou clergé de cette église)' })
  delete(@GetUser() user: JwtUserInfo, @Param('id') id: string) {
    return this.paymentMethodService.delete(user, id);
  }
}
