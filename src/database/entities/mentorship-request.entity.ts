import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Member } from './member.entity';

export type MentorshipStatus = 'pending' | 'assigned' | 'closed';

@Entity('mentorship_requests')
export class MentorshipRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'requester_id' })
  requesterId: string;

  @ManyToOne(() => Member, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requester_id' })
  requester: Member;

  @Column({ name: 'mentor_id', nullable: true })
  mentorId: string;

  @ManyToOne(() => Member, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'mentor_id' })
  mentor: Member;

  @Column()
  topic: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ default: 'pending' })
  status: MentorshipStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
