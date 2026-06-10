import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('cantiques')
export class Cantique {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  number: string;

  @Column({ nullable: true })
  author: string;

  @Column({ type: 'text' })
  lyrics: string;

  @Column({ nullable: true })
  source: string;

  @Column({ name: 'rights_note', nullable: true })
  rightsNote: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
