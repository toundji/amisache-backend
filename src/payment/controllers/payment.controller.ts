// ============================================================
// AMISACHE — payment.controller.ts
// Routes /payments/*  : détail (admin/engineer) + confirmation par le
// clergé (autorisation fine faite dans le service, §7.6) + upload reçu.
//
// Ce controller ne contient AUCUNE logique métier.
// Il délègue tout au PaymentService.
// ============================================================
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiQuery } from '@nestjs/swagger';
import { FormDataRequest } from 'nestjs-form-data';

import { PaymentService } from '../services/payment.service';
import { GetUser, Roles } from '../../core/decorators/api.decorator';
import { UserRole } from '../../shared/common.enum';
import { PaymentStatus } from '../payment.enum';
import { JwtUserInfo } from '../../auth/dto/auth.type.dto';
import { ImageDto } from '../../shared/media.dto';

import { UpdatePaymentStatusDto } from '../dto/payment.dto';
import type { ListPaymentQuery } from '../dto/payment.dto';

@ApiTags('Payment')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * GET /payments/admin — liste complète des paiements, toutes églises.
   * ⚠️ Déclarée AVANT `:id`.
   */
  @Get('admin')
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Liste complète des paiements (toutes églises)' })
  @ApiQuery({ name: 'status', required: false, enum: PaymentStatus })
  listAdmin(@Query() query: ListPaymentQuery) {
    return this.paymentService.listAdmin(query);
  }

  /**
   * GET /payments/church/:churchId — paiements d'UNE église (via
   * paymentMethod.churchId). Accès : admin/engineer, ou membre du clergé
   * ACTIF de cette église.
   */
  @Get('church/:churchId')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Liste complète des paiements d'une église (clergé de cette église, ou admin)" })
  @ApiQuery({ name: 'status', required: false, enum: PaymentStatus })
  listForChurch(
    @GetUser() user: JwtUserInfo,
    @Param('churchId') churchId: string,
    @Query() query: ListPaymentQuery,
  ) {
    return this.paymentService.listForChurch(user, churchId, query);
  }

  /**
   * GET /payments/:id — admin, engineer.
   * ⚠️ Pas de self-service ici : Payment ne porte pas de userId direct
   * (voir payment.entity.ts) ; l'accès fidèle passe par la Request/
   * Donation qui le référence.
   */
  @Get(':id')
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Récupérer un paiement par id' })
  getById(@Param('id') id: string) {
    return this.paymentService.getById(id);
  }

  /**
   * PATCH /payments/:id/status — confirmer ou rejeter.
   * Aucun rôle plateforme requis ici : l'autorisation réelle (§7.6) est
   * vérifiée dans PaymentService — seul un ClergyMember ACTIF de la
   * paroisse concernée peut agir, peu importe les UserRole de l'appelant.
   */
  @Patch(':id/status')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirmer ou rejeter un paiement (clergé de la paroisse uniquement)' })
  updateStatus(
    @GetUser() user: JwtUserInfo,
    @Param('id') id: string,
    @Body() body: UpdatePaymentStatusDto,
  ) {
    return this.paymentService.confirmOrReject(id, user.id, body.status);
  }

  /** POST /payments/receipt-image — upload du reçu avant soumission */
  @Post('receipt-image')
  @FormDataRequest()
  @ApiConsumes('multipart/form-data')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Uploader une image de reçu de paiement' })
  uploadReceiptImage(@Body() body: ImageDto) {
    return this.paymentService.uploadReceiptImage(body);
  }
}
