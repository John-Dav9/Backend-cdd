import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailTemplate } from '../database/entities/email-template.entity';
import { MailService } from './mail.service';

@Module({
  imports: [TypeOrmModule.forFeature([EmailTemplate])],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
