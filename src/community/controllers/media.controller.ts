// ============================================================
// AMISACHE — media.controller.ts
// Routes /media/*  : lecture publique (filtrée par publicationId) +
// gestion admin + upload de fichier (provider=UPLOAD).
//
// Ce controller ne contient AUCUNE logique métier.
// Il délègue tout au MediaService.
// ============================================================
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiQuery } from '@nestjs/swagger';
import { FormDataRequest } from 'nestjs-form-data';

import { MediaService } from '../services/media.service';
import { Public, Roles } from '../../core/decorators/api.decorator';
import { UserRole } from '../../shared/common.enum';
import { ImageVideoDto } from '../../shared/media.dto';

import { AddMediaDto, ListMediaQuery } from '../dto/media.dto';

@ApiTags('Community — Médias')
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  /** GET /media?publicationId=... — liste publique */
  @Get()
  @Public()
  @ApiOperation({ summary: "Lister les médias d'une publication" })
  @ApiQuery({ name: 'publicationId', required: true, type: String })
  list(@Query() query: ListMediaQuery) {
    return this.mediaService.listForPublication(query.publicationId);
  }

  /** POST /media/upload — admin, engineer (fichier avant AddMediaDto, provider=UPLOAD) */
  @Post('upload')
  @Roles(UserRole.admin, UserRole.engineer)
  @FormDataRequest()
  @ApiConsumes('multipart/form-data')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Uploader un fichier média (image/vidéo)' })
  upload(@Body() body: ImageVideoDto) {
    return this.mediaService.upload(body);
  }

  /** POST /media — admin, engineer */
  @Post()
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Rattacher un média à une publication' })
  add(@Body() body: AddMediaDto) {
    return this.mediaService.add(body);
  }

  /** DELETE /media/:id — admin, engineer */
  @Delete(':id')
  @Roles(UserRole.admin, UserRole.engineer)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Supprimer un média' })
  delete(@Param('id') id: string) {
    return this.mediaService.delete(id);
  }
}
