import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Member } from '../database/entities/member.entity';
import { MeetingParticipant } from '../database/entities/meeting-participant.entity';
import { Meeting } from '../database/entities/meeting.entity';
import { MailModule } from '../mail/mail.module';
import { AuthModule } from '../auth/auth.module';
import { JitsiService } from './jitsi.service';
import { MeetingGateway } from './meeting.gateway';
import { ReunionsController } from './reunions.controller';
import { ReunionsScheduler } from './reunions.scheduler';
import { ReunionsService } from './reunions.service';
import { StatsController } from './reunions.stats';
import { NotificationsModule } from '../notifications/notifications.module';
import { MeetingInvite } from '../database/entities/meeting-invite.entity';
import { User } from '../database/entities/user.entity';
import { MeetingRuntimeState } from '../database/entities/meeting-runtime-state.entity';
import { SpiritualBackground } from '../database/entities/spiritual-background.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Meeting,
      MeetingParticipant,
      MeetingInvite,
      MeetingRuntimeState,
      SpiritualBackground,
      Member,
      User,
    ]),
    MailModule,
    AuthModule,
    NotificationsModule,
  ],
  controllers: [ReunionsController, StatsController],
  providers: [ReunionsService, JitsiService, ReunionsScheduler, MeetingGateway],
  exports: [ReunionsService, JitsiService, MeetingGateway],
})
export class ReunionsModule {}
