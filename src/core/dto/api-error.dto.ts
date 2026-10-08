// ============================================================
// UNIFIED AUTH — api-error.dto.ts
// ============================================================
import { IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiErrorLog } from '../entities/api-error.entity';

export class ListApiErrorsQuery {
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  limit?: number;
}

export interface PaginatedApiErrors {
  data: ApiErrorLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
