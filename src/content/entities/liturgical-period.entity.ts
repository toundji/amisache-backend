// ============================================================
// AMISACHE — liturgical-period.entity.ts
// Référentiel des dates du temps liturgique (Avent, Carême, Temps
// ordinaire...) — contenu institutionnel, non rattaché à une église
// (§4.11 / EVOLUTION.md 2026-09-13 « temps liturgique »).
//
// ⚠️ Différent de `Schedule.season` (liturgy/) : ce référentiel dit
// "quand" une saison a lieu cette année ; `Schedule.season` dit "à quelle
// saison appartient cet horaire précis d'une paroisse". Le second se
// requête (compte) via le premier, jamais l'inverse — voir
// LiturgicalPeriodService.getStatus.
// ============================================================
import { Entity, Column, BeforeInsert } from 'typeorm';
import { Audit } from '../../shared/audit';
import { LiturgicalSeason } from '../../liturgy/liturgy.enum';

@Entity('liturgical_periods')
export class LiturgicalPeriod extends Audit {
  static entityName = 'liturgical_periods';
  static entityCode = '38';

  /** Libellé affiché (ex: "Avent", "Temps ordinaire") — la saison seule ne suffit pas à l'affichage */
  @Column()
  name!: string;

  @Column({ type: 'enum', enum: LiturgicalSeason })
  season!: LiturgicalSeason;

  @Column({ type: 'date', name: 'start_date' })
  startDate!: string;

  @Column({ type: 'date', name: 'end_date' })
  endDate!: string;

  /** Code lisible généré à l'insertion (ex: 38-1717000000000) */
  @Column()
  code?: string;

  @BeforeInsert()
  prepare() {
    this.name = this.name?.trim();
    this.code = LiturgicalPeriod.entityCode + Date.now();
  }
}
