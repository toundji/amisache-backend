// ============================================================
// UNIFIED AUTH — contact.dto.ts
// DTOs des routes /contact/*.
// ============================================================
import {
  IsString,
  IsEmail,
  IsOptional,
  IsNotEmpty,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { ContactMessageStatus } from '../../shared/common.enum';
import { ContactMessage } from '../entities/contact-message.entity';

// ── Formulaire public ──────────────────────────────────────────

export class CreateContactMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsEmail({}, { message: "L'email n'est pas valide." })
  email!: string;

  @IsString()
  @IsOptional()
  @MaxLength(160)
  subject?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  message!: string;
}

// ── Admin ─────────────────────────────────────────────────────

export class UpdateContactStatusDto {
  @IsEnum(ContactMessageStatus, { message: 'Statut invalide.' })
  status!: ContactMessageStatus;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  adminNote?: string;
}

// ── Pagination / filtres ────────────────────────────────────────

export type ListContactMessagesSortBy = 'createdAt' | 'status';

export interface ListContactMessagesQuery {
  page?: number;
  limit?: number;
  status?: ContactMessageStatus;
  search?: string;
  sortBy?: ListContactMessagesSortBy;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedContactMessages {
  data: ContactMessage[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
