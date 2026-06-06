import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Member } from '../database/entities/member.entity';
import { MeetingParticipant } from '../database/entities/meeting-participant.entity';
import { Meeting } from '../database/entities/meeting.entity';
import { MailModule } from '../mail/mail.module';
import { JitsiService } from './jitsi.service';
import { MeetingGateway } from './meeting.gateway';
import { ReunionsController } from './reunions.controller';
import { ReunionsScheduler } from './reunions.scheduler';
import { ReunionsService } from './reunions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Meeting, MeetingParticipant, Member]),
    MailModule,
  ],
  controllers: [ReunionsController],
  providers: [ReunionsService, JitsiService, ReunionsScheduler, MeetingGateway],
  exports: [ReunionsService, JitsiService, MeetingGateway],
})
export class ReunionsModule {}
