// ============================================================
// AMISACHE — country.service.ts
// Racine du module Adresse. CRUD admin + lecture publique
// (peuple le sélecteur pays à l'inscription / dans les formulaires).
// ============================================================
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Country } from '../entities/country.entity';
import { ApiError, ApiErrorNotFoundById } from '../../utils/api-error';
import { CreateCountryDto, ListCountryQuery, UpdateCountryDto } from '../dto/country.dto';

@Injectable()
export class CountryService {
  constructor(
    @InjectRepository(Country) private readonly countryRepo: Repository<Country>,
  ) {}

  // ── Public / lecture ──────────────────────────────────────

  async list(query: ListCountryQuery = {}): Promise<Country[]> {
    let qb = this.countryRepo.createQueryBuilder('c').orderBy('c.isoCode', 'ASC');

    if (query.search?.trim()) {
      qb = qb.andWhere('c.isoCode LIKE :term', { term: `%${query.search.trim()}%` });
    }

    return qb.getMany();
  }

  async getById(id: string): Promise<Country> {
    const country = await this.countryRepo.findOne({ where: { id } });
    if (!country) throw new ApiErrorNotFoundById('countries', id);
    return country;
  }

  // ── Admin — création / mise à jour / suppression ──────────

  async create(body: CreateCountryDto): Promise<Country> {
    const existing = await this.countryRepo.findOne({
      where: { isoCode: body.isoCode.trim().toUpperCase() },
    });
    if (existing) {
      throw new ApiError(`Le pays ${body.isoCode} existe déjà.`);
    }
    const country = this.countryRepo.create(body);
    return this.countryRepo.save(country);
  }

  async update(id: string, body: UpdateCountryDto): Promise<Country> {
    await this.getById(id);
    await this.countryRepo.update(id, body);
    return this.getById(id);
  }

  async delete(id: string): Promise<{ success: boolean }> {
    await this.getById(id);
    await this.countryRepo.delete(id);
    return { success: true };
  }
}
