import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('meeting_runtime_states')
export class MeetingRuntimeState {
  @PrimaryColumn({ name: 'meeting_id' })
  meetingId: string;

  @Column({ name: 'spiritual_event', type: 'jsonb', nullable: true })
  spiritualEvent: Record<string, any> | null;

  @Column({ name: 'active_poll', type: 'jsonb', nullable: true })
  activePoll: Record<string, any> | null;

  @Column({ name: 'poll_votes', type: 'jsonb', default: {} })
  pollVotes: Record<string, number>;

  @Column({ name: 'media_state', type: 'jsonb', default: {} })
  mediaState: Record<string, any>;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
