import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Meeting } from './meeting.entity';
import { Member } from './member.entity';

export type AdmissionStatus = 'pending' | 'admitted' | 'rejected';

@Entity('meeting_participants')
export class MeetingParticipant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Meeting, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'meeting_id' })
  meeting: Meeting;

  @Column({ name: 'meeting_id' })
  meetingId: string;

  @ManyToOne(() => Member, { nullable: true })
  @JoinColumn({ name: 'member_id' })
  member: Member;

  @Column({ name: 'member_id', nullable: true })
  memberId: string;

  @Column({ name: 'display_name' })
  displayName: string;

  @Column({ name: 'jitsi_participant_id', nullable: true })
  jitsiParticipantId: string;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt: Date;

  @Column({ name: 'left_at', nullable: true })
  leftAt: Date;

  @Column({ name: 'last_seen_at', nullable: true })
  lastSeenAt: Date;

  @Column({ name: 'was_admin', default: false })
  wasAdmin: boolean;

  @Column({ name: 'admission_status', default: 'admitted' })
  admissionStatus: AdmissionStatus;

  @Column({ name: 'admitted_at', nullable: true })
  admittedAt: Date;

  @Column({ name: 'reconnect_token', nullable: true })
  reconnectToken: string;

  @Column({ name: 'disconnect_count', default: 0 })
  disconnectCount: number;
}
