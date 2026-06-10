import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Member } from '../database/entities/member.entity';
import { Meeting } from '../database/entities/meeting.entity';
import { MeetingParticipant } from '../database/entities/meeting-participant.entity';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  imports: [TypeOrmModule.forFeature([Member, Meeting, MeetingParticipant])],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
