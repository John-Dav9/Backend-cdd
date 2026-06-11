import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Meeting } from './meeting.entity';

@Entity('meeting_access_links')
export class MeetingAccessLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'meeting_id' })
  meetingId: string;

  @ManyToOne(() => Meeting, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'meeting_id' })
  meeting: Meeting;

  @Column({ name: 'token_hash' })
  tokenHash: string;

  @Column({ nullable: true })
  label: string;

  @Column({ name: 'expires_at' })
  expiresAt: Date;

  @Column({ name: 'revoked_at', nullable: true })
  revokedAt: Date;

  @Column({ name: 'max_uses', nullable: true })
  maxUses: number;

  @Column({ name: 'use_count', default: 0 })
  useCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
