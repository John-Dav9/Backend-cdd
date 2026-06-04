import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type MemberRole = 'super_admin' | 'admin' | 'member' | 'visitor';
export type MemberSource = 'marathon' | 'newsletter' | 'registration' | 'invitation';

@Entity('members')
export class Member {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'first_name' })
  firstName: string;

  @Column({ name: 'last_name' })
  lastName: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  city: string;

  @Column({ default: 'member' })
  role: MemberRole;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ default: 'registration' })
  source: MemberSource;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'last_login_at', nullable: true })
  lastLoginAt: Date;
}
