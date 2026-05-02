import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('bibliotheque')
export class Bibliotheque {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  titre: string;

  @Column({ nullable: true })
  auteur: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  categorie: string;

  @Column({ name: 'pdf_url' })
  pdfUrl: string;

  @Column({ name: 'pdf_path' })
  pdfPath: string;

  @Column({ name: 'cover_url', nullable: true })
  coverUrl: string;

  @Column({ name: 'cover_path', nullable: true })
  coverPath: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
