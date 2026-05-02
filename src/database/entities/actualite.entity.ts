import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('actualites')
export class Actualite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  titre: string;

  @Column({ type: 'text', nullable: true })
  contenu: string;

  @Column({ nullable: true })
  auteur: string;

  @Column({ default: false })
  publiee: boolean;

  @Column({ type: 'jsonb', default: '[]' })
  tags: string[];

  @Column({ name: 'image_url', nullable: true })
  imageUrl: string;

  @Column({ name: 'video_id', nullable: true })
  videoId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
