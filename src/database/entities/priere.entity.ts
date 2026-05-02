import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('prieres')
export class Priere {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  prenom: string;

  @Column({ default: false })
  anonyme: boolean;

  @Column()
  sujet: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ nullable: true })
  email: string;

  @Column({ default: 'en_attente' })
  statut: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
