import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('marathon_inscriptions')
@Index(['marathonId', 'email'], { unique: true })
export class MarathonInscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'marathon_id' })
  marathonId: string;

  @Column({ name: 'full_name' })
  fullName: string;

  @Column()
  email: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  city: string;

  @Column({ type: 'jsonb', default: '{}' })
  progress: Record<string, boolean>;

  @Column({ name: 'progress_percent', type: 'decimal', precision: 5, scale: 2, default: 0 })
  progressPercent: number;

  @Column({ name: 'milestones_reached', type: 'jsonb', default: '[]' })
  milestonesReached: number[];

  @Column({ name: 'current_streak', default: 0 })
  currentStreak: number;

  @Column({ name: 'max_streak', default: 0 })
  maxStreak: number;

  @Column({ name: 'last_activity_at', nullable: true })
  lastActivityAt: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
