// ============================================================
// AMISACHE — community.module.ts
// Dépend de church/ (Publication/Group.church) et type/ (scope
// PUBLICATION) — jamais l'inverse. Dernier module métier du périmètre
// initial (AMISACHE.md §9 étape 6). Frontière avec content/ vérifiée :
// content/ ne porte aucune notion de publication (§6.2, §8).
// ============================================================
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Group } from './entities/group.entity';
import { GroupMember } from './entities/group-member.entity';
import { Publication } from './entities/publication.entity';
import { Media } from './entities/media.entity';

import { GroupService } from './services/group.service';
import { GroupMemberService } from './services/group-member.service';
import { PublicationService } from './services/publication.service';
import { MediaService } from './services/media.service';

import { GroupController } from './controllers/group.controller';
import { GroupMemberController } from './controllers/group-member.controller';
import { PublicationController } from './controllers/publication.controller';
import { MediaController } from './controllers/media.controller';

import { ChurchModule } from '../church/church.module';
import { TypeModule } from '../type/type.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Group, GroupMember, Publication, Media]),
    ChurchModule,
    TypeModule,
  ],
  controllers: [
    GroupController,
    GroupMemberController,
    PublicationController,
    MediaController,
  ],
  providers: [GroupService, GroupMemberService, PublicationService, MediaService],
  exports: [GroupService, GroupMemberService, PublicationService, MediaService],
})
export class CommunityModule {}
