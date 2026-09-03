// ============================================================
// UNIFIED AUTH — user.controller.ts
// Routes /users/*  : profil personnel + admin.
//
// Ce controller ne contient AUCUNE logique métier.
// Il délègue tout au UserService.
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
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiQuery,
} from '@nestjs/swagger';
import { FormDataRequest } from 'nestjs-form-data';

import { UserService } from '../services/user.service';

import { GetUser, Roles } from '../../core/decorators/api.decorator';
import { UserRole, UserStatus } from '../../shared/common.enum';
import { ImageDto } from '../../shared/media.dto';

// ⚠️ Import de valeur obligatoire (pas `import type`) pour les DTOs utilisés
// avec @Body() : NestJS lit design:paramtypes pour déterminer le metatype
// et décider s'il doit valider. `import type` efface la classe du JS émis
// → le paramètre retombe sur `Object` → ValidationPipe saute la validation
// en silence. Même piège documenté sur auth/controllers/auth.controller.ts.
import {
  AdminResetPasswordDto,
  AdminUpdateRolesDto,
  AdminUpdateStatusDto,
  UpdateProfileDto,
} from '../dto/user.dto';
import type { ListUsersQuery } from '../dto/user.dto';
import { JwtUserInfo } from '../../auth/dto/auth.type.dto';

// ── Controller ────────────────────────────────────────────────

@ApiTags('Users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // ── Profil personnel ──────────────────────────────────────

  /**
   * GET /users/me
   * Retourne le profil de l'utilisateur connecté.
   */
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Récupérer son profil' })
  getMe(@GetUser() user: JwtUserInfo) {
    return this.userService.getProfile(user.id);
  }

  /**
   * PATCH /users/me
   * Mise à jour partielle du profil (firstName, lastName, profile).
   * Les champs status et roles sont ignorés même s'ils sont envoyés.
   */
  @Patch('me')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Mettre à jour son profil (firstName, lastName, profile)',
  })
  updateMe(@GetUser() user: JwtUserInfo, @Body() body: UpdateProfileDto) {
    return this.userService.updateProfile(user.id, body);
  }

  /**
   * DELETE /users/me
   * Soft-delete : status → deleted + révocation de toutes les sessions.
   */
  @Delete('me')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Supprimer son compte (soft-delete → status deleted)',
  })
  deleteMe(@GetUser() user: JwtUserInfo) {
    return this.userService.softDeleteMe(user.id);
  }

  // ── Admin — liste ─────────────────────────────────────────

  /**
   * GET /users
   * Liste paginée de tous les utilisateurs avec filtres optionnels.
   * Accessible : admin, manager, engineer.
   */
  @Get()
  @Roles(UserRole.admin, UserRole.manager, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[Admin] Lister tous les utilisateurs (paginé + filtres)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Numéro de page (défaut: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Éléments par page (défaut: 20, max: 100)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: UserStatus,
    description: 'Filtrer par statut',
  })
  @ApiQuery({
    name: 'role',
    required: false,
    enum: UserRole,
    description: 'Filtrer par rôle',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Recherche sur email / firstName / lastName',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['firstName', 'lastName', 'email', 'status', 'createdAt'],
    description: 'Colonne de tri (défaut: createdAt)',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    enum: ['asc', 'desc'],
    description: 'Sens du tri (défaut: desc)',
  })
  listUsers(@Query() query: ListUsersQuery) {
    return this.userService.listUsers(query);
  }

  // ── Admin — lecture unitaire ──────────────────────────────

  /**
   * GET /users/:id
   * Récupérer un utilisateur par son id.
   * Accessible : admin, manager, engineer.
   */
  @Get(':id')
  @Roles(UserRole.admin, UserRole.manager, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Récupérer un utilisateur par id' })
  getUser(@Param('id') id: string) {
    return this.userService.getById(id);
  }

  // ── Admin — mise à jour statut ────────────────────────────

  /**
   * PATCH /users/:id/status
   * Changer le statut d'un utilisateur.
   * Bloquer ou supprimer révoque immédiatement toutes ses sessions.
   */
  @Patch(':id/status')
  @Roles(UserRole.admin, UserRole.manager)
  @ApiBearerAuth()
  @ApiOperation({ summary: "[Admin] Changer le statut d'un utilisateur" })
  updateStatus(@Param('id') id: string, @Body() body: AdminUpdateStatusDto) {
    return this.userService.updateStatus(id, body.status);
  }

  // ── Admin — mise à jour rôles ─────────────────────────────

  /**
   * PATCH /users/:id/roles
   * Modifier les rôles d'un utilisateur.
   * Accessible : admin uniquement.
   */
  @Patch(':id/roles')
  @Roles(UserRole.admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: "[Admin] Modifier les rôles d'un utilisateur" })
  updateRoles(@Param('id') id: string, @Body() body: AdminUpdateRolesDto) {
    return this.userService.updateRoles(id, body.roles);
  }

  // ── Admin — reset password ────────────────────────────────

  /**
   * PATCH /users/admin/reset-password
   * Réinitialiser le mot de passe d'un utilisateur.
   * Accessible : admin, engineer.
   *
   * ⚠️  Cette route doit être déclarée AVANT `:id` pour éviter
   * que NestJS interprète "admin" comme un id.
   */
  @Patch('admin/reset-password')
  @Roles(UserRole.admin, UserRole.engineer)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "[Admin] Réinitialiser le mot de passe d'un utilisateur",
  })
  adminResetPassword(@Body() body: AdminResetPasswordDto) {
    return this.userService.adminResetPassword(
      body.userIdOrEmail,
      body.newPassword,
    );
  }

  // ── Admin — suppression définitive ───────────────────────

  /**
   * DELETE /users/:id
   * Hard-delete : suppression définitive de la DB.
   * Impossible de supprimer son propre compte via cette route.
   * Accessible : admin uniquement.
   */
  @Delete(':id')
  @Roles(UserRole.admin)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Supprimer définitivement un utilisateur' })
  hardDelete(@GetUser() caller: JwtUserInfo, @Param('id') id: string) {
    return this.userService.hardDelete(caller.id, id);
  }

  // ── Photo de profil ───────────────────────────────────────

  /**
   * POST /users/profile/image
   * Uploader/remplacer sa propre photo de profil.
   */
  @Post('profile/image')
  @FormDataRequest()
  @ApiConsumes('multipart/form-data')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Uploader sa photo de profil' })
  updateProfileImage(@GetUser() user: JwtUserInfo, @Body() body: ImageDto) {
    return this.userService.updateImageProfile(user.id, body);
  }

  /**
   * POST /users/:id/profile/image
   * Uploader/remplacer la photo de profil d'un utilisateur quelconque
   * (ex: juste après sa création depuis le back-office).
   * Accessible : admin uniquement.
   */
  @Post(':id/profile/image')
  @Roles(UserRole.admin)
  @FormDataRequest()
  @ApiConsumes('multipart/form-data')
  @ApiBearerAuth()
  @ApiOperation({ summary: "[Admin] Uploader la photo de profil d'un utilisateur" })
  adminUpdateProfileImage(@Param('id') id: string, @Body() body: ImageDto) {
    return this.userService.updateImageProfile(id, body);
  }
}
