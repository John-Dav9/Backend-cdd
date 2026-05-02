import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('marathons')
export class Marathon {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  titre: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'date_debut' })
  dateDebut: string;

  @Column({ name: 'date_fin' })
  dateFin: string;

  @Column()
  scope: string;

  @Column({ name: 'livres_choisis', type: 'jsonb', default: '[]' })
  livresChoisis: string[];

  @Column({ name: 'nb_jours', nullable: true })
  nbJours: number;

  @Column({ default: 'PLANIFIE' })
  statut: string;

  @Column({ name: 'plan_lecture', type: 'jsonb', default: '[]' })
  planLecture: any[];

  @Column({ name: 'nb_inscrits', default: 0 })
  nbInscrits: number;

  @Column({ name: 'flyer_url', nullable: true })
  flyerUrl: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
