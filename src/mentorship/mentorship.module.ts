import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Member } from '../database/entities/member.entity';
import { MentorshipRequest } from '../database/entities/mentorship-request.entity';
import { MentorshipController } from './mentorship.controller';
import { MentorshipService } from './mentorship.service';

@Module({
  imports: [TypeOrmModule.forFeature([MentorshipRequest, Member])],
  controllers: [MentorshipController],
  providers: [MentorshipService],
})
export class MentorshipModule {}
