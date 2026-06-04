import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Member } from './member.entity';

@Entity('community_settings')
export class CommunitySettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'is_open', default: true })
  isOpen: boolean;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Member, { nullable: true })
  @JoinColumn({ name: 'updated_by' })
  updatedBy: Member;

  @Column({ name: 'updated_by', nullable: true })
  updatedById: string;
}
