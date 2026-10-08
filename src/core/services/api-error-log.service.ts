// ============================================================
// UNIFIED AUTH — api-error-log.service.ts
// Écrit les 5xx dans `api_errors` (ApiErrorFilter) et purge les entrées
// anciennes. Écriture best-effort : ne doit jamais faire échouer la
// réponse HTTP qui a déclenché l'erreur — voir `log()`.
// ============================================================
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { LessThan, Repository } from 'typeorm';
import { ApiErrorLog } from '../entities/api-error.entity';
import { ApiErrorNotFoundById } from '../../utils/api-error';
import { ListApiErrorsQuery, PaginatedApiErrors } from '../dto/api-error.dto';

const RETENTION_DAYS = 30;

export interface ApiErrorLogInput {
  errorId: string;
  statusCode: number;
  method: string;
  path: string;
  userEmail?: string;
  ip?: string;
  message: string;
  stack?: string;
}

@Injectable()
export class ApiErrorLogService {
  private readonly logger = new Logger('ApiErrorLogService');

  constructor(@InjectRepository(ApiErrorLog) private readonly repo: Repository<ApiErrorLog>) {}

  /**
   * Ne jamais attendre ce résultat depuis le filtre — appelé en
   * fire-and-forget, une panne DB ne doit jamais retarder/faire échouer la
   * réponse d'erreur déjà envoyée au client.
   */
  async log(input: ApiErrorLogInput): Promise<void> {
    try {
      await this.repo.insert(this.repo.create(input));
    } catch (err) {
      // Ne PAS relancer via ApiErrorFilter (boucle) — simple log serveur.
      this.logger.error(`Échec d'enregistrement de l'erreur ${input.errorId}`, err as Error);
    }
  }

  /** Chaque nuit à 4h — purge les entrées de plus de 30 jours. */
  @Cron('0 4 * * *')
  async purge(): Promise<void> {
    const threshold = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const result = await this.repo.delete({ createdAt: LessThan(threshold) });
    this.logger.log(`[Cron] Purged ${result.affected ?? 0} old api_errors rows.`);
  }

  /**
   * Liste paginée, plus récentes d'abord — consommée par le panel (admin/
   * engineer) et par la route publique à jeton (voir ApiErrorController).
   */
  async list(query: ListApiErrorsQuery): Promise<PaginatedApiErrors> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));

    const [data, total] = await this.repo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  /** Supprime une entrée — le clergé/admin l'a corrigée, elle n'a plus besoin d'être gardée. */
  async delete(id: string): Promise<void> {
    const result = await this.repo.delete({ id });
    if (!result.affected) throw new ApiErrorNotFoundById('api_errors', id);
  }
}
