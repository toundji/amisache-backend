// ============================================================
// AMISACHE — type.entity.ts
// Table de types mutualisée : centralise toutes les listes évolutives
// (intentions, sacrements, dons, publications, horaires), discriminées
// par `scope`. Ajouter une valeur = une ligne, jamais un redéploiement.
// Voir cahier-des-charges-amisache.md §4.10.
// ============================================================
import { Entity, Column, Index, BeforeInsert } from 'typeorm';
import { Audit } from '../../shared/audit';
import { TypeScope } from '../type.enum';

@Entity('types')
@Index(['scope', 'name'], { unique: true })
export class Type extends Audit {
  static entityName = 'types';
  static entityCode = '20';

  @Column()
  name!: string;

  @Column({ type: 'enum', enum: TypeScope })
  scope!: TypeScope;

  /** Un type désactivé reste référencé par l'historique mais disparaît des listes actives */
  @Column({ default: true })
  active!: boolean;

  /**
   * Ce type (INTENTION/SACRAMENT) peut-il être demandé en célébration à
   * domicile plutôt qu'à l'église ? Faux par défaut — un type existant ne
   * devient éligible que si l'admin/clergé le décide explicitement (ex. une
   * intention pour un malade, mais pas un baptême ou un mariage).
   */
  @Column({ default: false, name: 'allow_home_celebration' })
  allowHomeCelebration!: boolean;

  /**
   * Délai minimum, en jours, entre l'envoi d'une demande de ce type et la
   * date souhaitée — variable selon le type (ex. une intention simple vs un
   * mariage qui demande davantage de préparation).
   */
  @Column({ type: 'int', default: 2, name: 'min_lead_days' })
  minLeadDays!: number;

  /**
   * La date souhaitée doit-elle correspondre à une messe déjà programmée
   * (Schedule) par la paroisse choisie ? Ignoré si la paroisse n'a publié
   * aucun horaire — la date reste alors libre (RequestService.create).
   */
  @Column({ default: false, name: 'requires_schedule_match' })
  requiresScheduleMatch!: boolean;

  /** Code lisible généré à l'insertion (ex: 20-1717000000000) */
  @Column()
  code?: string;

  @BeforeInsert()
  prepare() {
    this.name = this.name?.trim();
    this.code = Type.entityCode + Date.now();
  }
}
