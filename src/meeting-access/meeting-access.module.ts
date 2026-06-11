import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { MeetingAccessLink } from '../database/entities/meeting-access-link.entity';
import { Meeting } from '../database/entities/meeting.entity';
import { MeetingAccessController } from './meeting-access.controller';
import { MeetingAccessService } from './meeting-access.service';

@Module({
  imports: [TypeOrmModule.forFeature([MeetingAccessLink, Meeting]), AuthModule],
  controllers: [MeetingAccessController],
  providers: [MeetingAccessService],
})
export class MeetingAccessModule {}
