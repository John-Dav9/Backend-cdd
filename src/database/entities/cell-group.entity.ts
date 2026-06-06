import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('cell_groups')
export class CellGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'leader_id', nullable: true })
  leaderId: string;

  @Column({ name: 'leader_name', nullable: true })
  leaderName: string;

  @Column({ type: 'simple-array', nullable: true })
  memberIds: string[];

  @Column({ name: 'jitsi_room_id', nullable: true })
  jitsiRoomId: string;

  @Column({ name: 'meeting_day', nullable: true })
  meetingDay: string; // ex: 'Vendredi'

  @Column({ name: 'meeting_time', nullable: true })
  meetingTime: string; // ex: '20:00'

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
