// ============================================================
// UNIFIED AUTH — user.service.ts
// Toute la logique métier liée aux utilisateurs.
// Le controller ne fait que router HTTP → ici.
// ============================================================
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, ILike, FindOptionsWhere } from 'typeorm';

import { User } from '../entities/user.entity';
import { PasswordService } from '../../auth/services/password.service';
import { SessionService } from '../../auth/services/session.service';
import { ApiError, ApiErrorNotFoundById } from '../../utils/api-error';
import { UserRole, UserStatus } from '../../shared/common.enum';
import { ImageDto } from '../../shared/media.dto';
import { ApiFsUtils } from '../../utils/api-fs';
import {
  UpdateProfileDto,
  ListUsersQuery,
  ListUsersSortBy,
  PaginatedUsers,
} from '../dto/user.dto';

// Whitelist colonne logique → colonne d'entité réelle (jamais le nom de
// colonne du client tel quel dans un ORDER BY, même via QueryBuilder).
const SORTABLE_COLUMNS: Record<ListUsersSortBy, string> = {
  firstName: 'u.firstName',
  lastName: 'u.lastName',
  email: 'u.email',
  status: 'u.status',
  createdAt: 'u.createdAt',
};

// ── Champs autorisés en retour (jamais le password ni le code interne) ──

const USER_SAFE_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  profile: true,
  status: true,
  roles: true,
  idCountry: true,
  createdAt: true,
  updatedAt: true,
};

// ── Service ───────────────────────────────────────────────────

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly sessionService: SessionService,
    private readonly passwordService: PasswordService,
  ) {}

  // ── Profil personnel ──────────────────────────────────────

  getProfile(userId: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: { id: userId },
      select: USER_SAFE_SELECT,
    });
  }

  async updateProfile(
    userId: string,
    body: UpdateProfileDto,
  ): Promise<User | null> {
    // Whitelist explicite — impossible d'auto-attribuer status/roles via cette route
    const ALLOWED: (keyof UpdateProfileDto)[] = [
      'firstName',
      'lastName',
      'profile',
    ];
    const patch: Partial<User> = {};
    for (const key of ALLOWED) {
      if (body[key] !== undefined) (patch as any)[key] = body[key];
    }
    if (Object.keys(patch).length === 0) {
      throw new ApiError('No valid fields to update.');
    }
    await this.userRepo.update(userId, patch);
    return this.getProfile(userId);
  }

  async softDeleteMe(userId: string): Promise<{ success: boolean }> {
    await this.userRepo.update(userId, { status: UserStatus.deleted });
    await this.sessionService.deleteAllSessions(userId);
    return { success: true };
  }

  // ── Admin — lecture / liste ───────────────────────────────

  async getById(id: string): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { id },
      select: USER_SAFE_SELECT,
    });
    if (!user) throw new ApiErrorNotFoundById('users', id);
    return user;
  }

  /**
   * Liste paginée avec filtres optionnels.
   * Accessible uniquement aux rôles admin / manager / engineer.
   */
  async listUsers(query: ListUsersQuery): Promise<PaginatedUsers> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<User> = {};

    if (query.status) {
      where.status = query.status;
    }

    const sortColumn = SORTABLE_COLUMNS[query.sortBy!] ?? SORTABLE_COLUMNS.createdAt;
    const sortOrder = query.sortOrder === 'asc' ? 'ASC' : 'DESC';

    // Filtre par rôle — MySQL SET type : on passe par QueryBuilder
    // (TypeORM ne supporte pas nativement FIND_IN_SET sur les colonnes SET)
    let qb = this.userRepo
      .createQueryBuilder('u')
      .select(Object.keys(USER_SAFE_SELECT).map((f) => `u.${f}`))
      .skip(skip)
      .take(limit)
      .orderBy(sortColumn, sortOrder);

    if (query.status) {
      qb = qb.andWhere('u.status = :status', { status: query.status });
    }

    if (query.role) {
      // FIND_IN_SET fonctionne sur les colonnes MySQL de type SET
      qb = qb.andWhere('FIND_IN_SET(:role, u.roles) > 0', { role: query.role });
    }

    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      qb = qb.andWhere(
        '(u.email LIKE :term OR u.first_name LIKE :term OR u.last_name LIKE :term)',
        { term },
      );
    }

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ── Admin — mise à jour statut ────────────────────────────

  async updateStatus(
    id: string,
    status: UserStatus,
  ): Promise<{ success: boolean }> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new ApiErrorNotFoundById('users', id);

    await this.userRepo.update(id, { status });

    // Bloquer ou supprimer → invalider toutes les sessions actives immédiatement
    if (status === UserStatus.blocked || status === UserStatus.deleted) {
      await this.sessionService.deleteAllSessions(id);
    }

    return { success: true };
  }

  // ── Admin — mise à jour rôles ─────────────────────────────

  async updateRoles(
    id: string,
    roles: UserRole[],
  ): Promise<{ success: boolean }> {
    if (!roles?.length) {
      throw new ApiError('Au moins un rôle est requis.');
    }
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new ApiErrorNotFoundById('users', id);

    await this.userRepo.update(id, { roles });
    return { success: true };
  }

  // ── Admin — reset password ────────────────────────────────

  adminResetPassword(userIdOrEmail: string, newPassword: string) {
    return this.passwordService.adminResetPassword(userIdOrEmail, newPassword);
  }

  // ── Admin — suppression définitive ───────────────────────

  async hardDelete(
    callerId: string,
    targetId: string,
  ): Promise<{ success: boolean }> {
    if (callerId === targetId) {
      throw new ApiError(
        'Impossible de supprimer son propre compte via cette route.',
      );
    }
    const user = await this.userRepo.findOne({ where: { id: targetId } });
    if (!user) throw new ApiErrorNotFoundById('users', targetId);

    await this.sessionService.deleteAllSessions(targetId);
    await this.userRepo.delete(targetId);

    return { success: true };
  }

  // ── Photo de profil ───────────────────────────────────────

  async updateImageProfile(id: string, body: ImageDto): Promise<User> {
    const user: User = await this.getById(id);
    const image = body.image;
    if (image) {
      const dir = ApiFsUtils.createDir('profiles');
      const key = `${Date.now()}${Math.ceil(Math.random() * 100)}`;
      const path = `${dir}/prof_${key}.${image['fileType']['ext']}`;

      ApiFsUtils.saveFile(image.path, path);

      const url = ApiFsUtils.pathToUrl(path);
      user.profile = url;

      await this.userRepo.update(id, { profile: url });
    }

    return user;
  }
}
