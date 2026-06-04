import { Column, CreateDateColumn, Entity, ManyToOne, JoinColumn, PrimaryGeneratedColumn } from 'typeorm';
import { Member } from './member.entity';

export type MeetingStatus = 'scheduled' | 'live' | 'ended' | 'cancelled';

@Entity('meetings')
export class Meeting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column({ name: 'start_time' })
  startTime: Date;

  @Column({ name: 'end_time', nullable: true })
  endTime: Date;

  @Column({ name: 'is_public', default: true })
  isPublic: boolean;

  @Column({ name: 'is_recurring', default: false })
  isRecurring: boolean;

  @Column({ name: 'recurrence_rule', nullable: true })
  recurrenceRule: string;

  @Column({ name: 'jitsi_room_id', unique: true })
  jitsiRoomId: string;

  @Column({ default: 'scheduled' })
  status: MeetingStatus;

  @ManyToOne(() => Member, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: Member;

  @Column({ name: 'created_by', nullable: true })
  createdById: string;

  @Column({ name: 'recording_path', nullable: true })
  recordingPath: string;

  @Column({ name: 'participant_count', default: 0 })
  participantCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
