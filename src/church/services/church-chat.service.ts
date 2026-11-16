// ============================================================
// AMISACHE — church-chat.service.ts
// Fil de discussion fidèle ⇄ paroisse, porté par le module générique chat/ (polymorphe : sujet
// `church-faithful`, subjectId `<churchId>:<userId>`, aucune FK). church/ dépend de chat/, jamais
// l'inverse (AMISACHE.md §6.1). Les messages passent ensuite par les routes génériques /chat/*.
// ============================================================
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';

import { CHURCH_FAITHFUL_SUBJECT_TYPE, ChatService } from '../../chat/services/chat.service';
import { ParticipantRole } from '../../chat/chat.enum';
import { Conversation } from '../../chat/entities/conversation.entity';
import { ActorType } from '../../shared/common.enum';
import { JwtUserInfo } from '../../auth/dto/auth.type.dto';
import { User } from '../../users/entities/user.entity';
import { ClergyMember } from '../entities/clergy-member.entity';
import { ChurchService } from './church.service';
import { ClergyMemberService } from './clergy-member.service';

/** Fil vu par l'équipe de la paroisse : le fidèle qui l'a ouvert + les non-lus de l'appelant. */
export type FilParoisse = Conversation & {
  unreadCount: number;
  faithful: Pick<User, 'id' | 'firstName' | 'lastName' | 'profile'> | null;
};

@Injectable()
export class ChurchChatService {
  constructor(
    private readonly chatService: ChatService,
    private readonly churchService: ChurchService,
    private readonly clergyMemberService: ClergyMemberService,
    @InjectRepository(ClergyMember)
    private readonly clergyRepo: Repository<ClergyMember>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /** POST /church-chat/:churchId — le fidèle ouvre (ou reprend) son fil avec la paroisse ; son clergé actif y est ajouté. */
  async ouvrir(user: JwtUserInfo, churchId: string): Promise<Conversation> {
    await this.churchService.getById(churchId); // 404 propre si l'église est inconnue
    const clerge = await this.clergeActif(churchId);
    return this.chatService.openSubjectThread(
      CHURCH_FAITHFUL_SUBJECT_TYPE,
      `${churchId}:${user.id}`,
      { actorId: user.id, actorType: ActorType.HUMAN },
      clerge
        .filter((id) => id !== user.id)
        .map((id) => ({ actor: { actorId: id, actorType: ActorType.HUMAN }, role: ParticipantRole.CLERGY })),
    );
  }

  /**
   * GET /church-chat/:churchId/conversations — fils de la paroisse pour son clergé actif (ou admin).
   * L'appelant devient participant de chaque fil (un membre arrivé après l'ouverture peut répondre).
   */
  async listerPourEquipe(user: JwtUserInfo, churchId: string): Promise<FilParoisse[]> {
    await this.churchService.getById(churchId);
    await this.clergyMemberService.assertAuthorizedForChurch(user, churchId);
    const fils = await this.chatService.listBySubjectPrefix(CHURCH_FAITHFUL_SUBJECT_TYPE, `${churchId}:`);
    for (const f of fils) {
      await this.chatService.addParticipant(f.id, { actorId: user.id, actorType: ActorType.HUMAN }, ParticipantRole.CLERGY);
    }
    const nonLus = await this.chatService.unreadCounts(fils.map((f) => f.id), user.id);
    const ids = fils.map((f) => f.subjectId!.split(':')[1]).filter(Boolean);
    const fideles = ids.length
      ? await this.userRepo.find({ where: { id: In(ids) }, select: { id: true, firstName: true, lastName: true, profile: true } })
      : [];
    return fils.map((f) =>
      Object.assign(f, {
        unreadCount: nonLus[f.id] ?? 0,
        faithful: fideles.find((u) => u.id === f.subjectId!.split(':')[1]) ?? null,
      }),
    );
  }

  private async clergeActif(churchId: string): Promise<string[]> {
    const today = new Date().toISOString().slice(0, 10);
    const lignes = await this.clergyRepo.find({
      where: [
        { churchId, endDate: IsNull(), startDate: LessThanOrEqual(today) },
        { churchId, endDate: MoreThanOrEqual(today), startDate: LessThanOrEqual(today) },
      ],
      select: { id: true, userId: true },
    });
    return [...new Set(lignes.map((l) => l.userId))];
  }
}
