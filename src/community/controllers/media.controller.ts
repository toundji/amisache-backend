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
import { GetUser, Public, Roles } from '../../core/decorators/api.decorator';
import { UserRole } from '../../shared/common.enum';
import { ImageVideoDto } from '../../shared/media.dto';
import { JwtUserInfo } from '../../auth/dto/auth.type.dto';

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

  /**
   * POST /media/upload — admin/engineer/clergy (fichier avant AddMediaDto,
   * provider=UPLOAD). Pas de scoping par église ici : le fichier n'est pas
   * encore rattaché à une publication, c'est `add` qui vérifie l'église.
   */
  @Post('upload')
  @Roles(UserRole.admin, UserRole.engineer, UserRole.clergy)
  @FormDataRequest()
  @ApiConsumes('multipart/form-data')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Uploader un fichier média, image ou vidéo (admin, ou clergé)' })
  upload(@Body() body: ImageVideoDto) {
    return this.mediaService.upload(body);
  }

  /** POST /media — admin/engineer, ou clergé ACTIF de l'église de la publication visée */
  @Post()
  @Roles(UserRole.admin, UserRole.engineer, UserRole.clergy)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Rattacher un média à une publication (admin, ou clergé de cette église)' })
  add(@GetUser() user: JwtUserInfo, @Body() body: AddMediaDto) {
    return this.mediaService.add(user, body);
  }

  /** DELETE /media/:id — admin/engineer, ou clergé ACTIF de l'église de la publication */
  @Delete(':id')
  @Roles(UserRole.admin, UserRole.engineer, UserRole.clergy)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Supprimer un média (admin, ou clergé de cette église)' })
  delete(@GetUser() user: JwtUserInfo, @Param('id') id: string) {
    return this.mediaService.delete(user, id);
  }
}
