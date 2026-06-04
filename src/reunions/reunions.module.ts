import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Member } from '../database/entities/member.entity';
import { MeetingParticipant } from '../database/entities/meeting-participant.entity';
import { Meeting } from '../database/entities/meeting.entity';
import { MailModule } from '../mail/mail.module';
import { JitsiService } from './jitsi.service';
import { ReunionsController } from './reunions.controller';
import { ReunionsService } from './reunions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Meeting, MeetingParticipant, Member]),
    MailModule,
  ],
  controllers: [ReunionsController],
  providers: [ReunionsService, JitsiService],
  exports: [ReunionsService, JitsiService],
})
export class ReunionsModule {}
