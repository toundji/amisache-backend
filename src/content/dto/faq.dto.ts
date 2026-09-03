// ============================================================
// UNIFIED AUTH — faq.dto.ts
// DTOs des routes /faq/*.
// ============================================================
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';
import { FaqCategory } from '../../shared/common.enum';
import { Faq } from '../entities/faq.entity';

// ── Admin — création / mise à jour ──────────────────────────────

export class CreateFaqDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  question!: string;

  /** Optionnel — laisser vide crée un brouillon (answeredAt reste null) */
  @IsString()
  @IsOptional()
  answer?: string;

  @IsEnum(FaqCategory, { message: 'Catégorie invalide.' })
  @IsOptional()
  category?: FaqCategory;

  @IsInt()
  @IsOptional()
  sortOrder?: number;
}

export class UpdateFaqDto {
  @IsString()
  @IsOptional()
  @MaxLength(500)
  question?: string;

  /** Vider (chaîne vide) repasse la FAQ en brouillon */
  @IsString()
  @IsOptional()
  answer?: string;

  /** null → retire la catégorie */
  @IsEnum(FaqCategory, { message: 'Catégorie invalide.' })
  @IsOptional()
  category?: FaqCategory | null;

  @IsInt()
  @IsOptional()
  sortOrder?: number;

  /** true → masque la FAQ même répondue, false → la republie (hiddenAt) */
  @IsBoolean()
  @IsOptional()
  hidden?: boolean;
}

// ── Requêtes de liste ────────────────────────────────────────────

export interface ListFaqPublicQuery {
  /** Filtrer par catégorie */
  category?: FaqCategory;
}

export interface ListFaqAdminQuery {
  page?: number;
  limit?: number;
  category?: FaqCategory;
  /** Filtrer sur la présence d'une réponse (answeredAt renseigné ou non) */
  answered?: boolean;
  search?: string;
}

export interface PaginatedFaqs {
  data: Faq[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
