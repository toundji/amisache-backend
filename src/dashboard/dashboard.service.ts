// ============================================================
// AMISACHE — dashboard.service.ts
// Chiffres de l'accueil du panel : ce qui attend une action (demandes,
// paiements, églises à valider) + volumes de contenu. Module en bout de
// chaîne — il lit les tables métier, rien ne dépend de lui.
// ============================================================
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Request } from '../liturgy/entities/request.entity';
import { RequestStatus } from '../liturgy/liturgy.enum';
import { Payment } from '../payment/entities/payment.entity';
import { PaymentStatus } from '../payment/payment.enum';
import { Publication } from '../community/entities/publication.entity';
import { PublicationStatus } from '../community/community.enum';
import { Church } from '../church/entities/church.entity';
import { ValidationStatus } from '../church/church.enum';
import { ChurchService } from '../church/services/church.service';
import { ClergyMemberService } from '../church/services/clergy-member.service';
import { JwtUserInfo } from '../auth/dto/auth.type.dto';
import { UserRole } from '../shared/common.enum';
import { ApiError } from '../utils/api-error';

export interface DashboardStats {
  /** Demandes reçues, pas encore prises en charge (SUBMITTED). */
  pendingRequests: number;
  /** Demandes en cours de traitement (IN_PROGRESS). */
  inProgressRequests: number;
  /** Paiements déclarés en attente de confirmation par le clergé. */
  pendingPayments: number;
  /** Publications en ligne. */
  publishedPublications: number;
  /** Plateforme seulement (sans `churchId`) — null sinon. */
  churches: number | null;
  /** Églises en attente de validation — plateforme seulement, null sinon. */
  pendingChurches: number | null;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Request) private readonly requestRepo: Repository<Request>,
    @InjectRepository(Payment) private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Publication) private readonly publicationRepo: Repository<Publication>,
    @InjectRepository(Church) private readonly churchRepo: Repository<Church>,
    private readonly churchService: ChurchService,
    private readonly clergyMemberService: ClergyMemberService,
  ) {}

  /**
   * Sans `churchId` : toute la plateforme (admin/engineer uniquement).
   * Avec `churchId` : une seule église — clergé ACTIF de cette église, ou admin/engineer.
   */
  async stats(user: JwtUserInfo, churchId?: string): Promise<DashboardStats> {
    if (churchId) {
      await this.churchService.getById(churchId); // 404 propre si churchId invalide
      await this.clergyMemberService.assertAuthorizedForChurch(user, churchId);
    } else if (!user.roles.includes(UserRole.admin) && !user.roles.includes(UserRole.engineer)) {
      throw new ApiError('Précisez une église pour consulter ses chiffres.', { code: HttpStatus.FORBIDDEN });
    }

    const scope = churchId ? { churchId } : {};
    const payments = this.paymentRepo
      .createQueryBuilder('p')
      .where('p.status = :status', { status: PaymentStatus.SUBMITTED });
    if (churchId) {
      payments.innerJoin('p.paymentMethod', 'pm').andWhere('pm.churchId = :churchId', { churchId });
    }

    const [pendingRequests, inProgressRequests, pendingPayments, publishedPublications, churches, pendingChurches] =
      await Promise.all([
        this.requestRepo.count({ where: { ...scope, status: RequestStatus.SUBMITTED } }),
        this.requestRepo.count({ where: { ...scope, status: RequestStatus.IN_PROGRESS } }),
        payments.getCount(),
        this.publicationRepo.count({ where: { ...scope, status: PublicationStatus.PUBLISHED } }),
        churchId ? null : this.churchRepo.count(),
        churchId ? null : this.churchRepo.count({ where: { status: ValidationStatus.PENDING } }),
      ]);

    return { pendingRequests, inProgressRequests, pendingPayments, publishedPublications, churches, pendingChurches };
  }
}
