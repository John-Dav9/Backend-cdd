import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type OtpType = 'sms' | 'magic_link' | 'admin_login';

@Entity('otp_codes')
export class OtpCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  email: string;

  @Column()
  code: string;

  @Column()
  type: OtpType;

  @Column({ name: 'expires_at' })
  expiresAt: Date;

  @Column({ name: 'used_at', nullable: true })
  usedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
