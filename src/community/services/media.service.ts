// ============================================================
// AMISACHE — media.service.ts
// Médias (0..*) rattachés à une publication.
// ============================================================
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Media } from '../entities/media.entity';
import { PublicationService } from './publication.service';
import { ClergyMemberService } from '../../church/services/clergy-member.service';
import { ApiErrorNotFoundById } from '../../utils/api-error';
import { ApiFsUtils } from '../../utils/api-fs';
import { ImageVideoDto } from '../../shared/media.dto';
import { AddMediaDto } from '../dto/media.dto';
import { JwtUserInfo } from '../../auth/dto/auth.type.dto';

@Injectable()
export class MediaService {
  constructor(
    @InjectRepository(Media) private readonly mediaRepo: Repository<Media>,
    private readonly publicationService: PublicationService,
    private readonly clergyMemberService: ClergyMemberService,
  ) {}

  async listForPublication(publicationId: string): Promise<Media[]> {
    return this.mediaRepo.find({
      where: { publicationId },
      order: { createdAt: 'ASC' },
    });
  }

  async getById(id: string): Promise<Media> {
    const media = await this.mediaRepo.findOne({ where: { id } });
    if (!media) throw new ApiErrorNotFoundById('media', id);
    return media;
  }

  async add(user: JwtUserInfo, body: AddMediaDto): Promise<Media> {
    const publication = await this.publicationService.getById(body.publicationId); // 404 propre si invalide
    await this.clergyMemberService.assertAuthorizedForChurch(user, publication.churchId);
    const media = this.mediaRepo.create(body);
    return this.mediaRepo.save(media);
  }

  async delete(user: JwtUserInfo, id: string): Promise<{ success: boolean }> {
    const media = await this.getById(id);
    const publication = await this.publicationService.getById(media.publicationId);
    await this.clergyMemberService.assertAuthorizedForChurch(user, publication.churchId);
    await this.mediaRepo.delete(id);
    return { success: true };
  }

  /** Upload d'un fichier (provider=UPLOAD) avant AddMediaDto */
  async upload(body: ImageVideoDto): Promise<{ url: string }> {
    const image = body.image;
    const dir = ApiFsUtils.createDir('media');
    const key = `${Date.now()}${Math.ceil(Math.random() * 100)}`;
    // `.extension` retombe sur l'extension du nom d'origine si la détection
    // par magic number échoue — `image['fileType']['ext']` plante dès que
    // `fileType` est `undefined` (cf. payment.service.ts, même correctif).
    const path = `${dir}/media_${key}.${image.extension}`;

    ApiFsUtils.saveFile(image.path, path);
    return { url: ApiFsUtils.pathToUrl(path) };
  }
}
