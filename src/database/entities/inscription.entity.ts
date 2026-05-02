import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('inscriptions')
export class Inscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  type: string;

  @Column()
  nom: string;

  @Column()
  prenom: string;

  @Column()
  email: string;

  @Column({ nullable: true })
  telephone: string;

  @Column({ name: 'date_culte', nullable: true })
  dateCulte: string;

  @Column({ name: 'pseudo_telegram', nullable: true })
  pseudoTelegram: string;

  @Column({ nullable: true })
  departement: string;

  @Column({ name: 'enfant_prenom', nullable: true })
  enfantPrenom: string;

  @Column({ name: 'enfant_age', nullable: true })
  enfantAge: string;

  @Column({ nullable: true })
  universite: string;

  @Column({ name: 'type_voix', nullable: true })
  typeVoix: string;

  @Column({ default: 'CONFIRME' })
  statut: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
