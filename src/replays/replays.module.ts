import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Recording } from '../database/entities/recording.entity';
import { ReplaysController } from './replays.controller';
import { ReplaysService } from './replays.service';
import { Meeting } from '../database/entities/meeting.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Recording, Meeting])],
  controllers: [ReplaysController],
  providers: [ReplaysService],
  exports: [ReplaysService],
})
export class ReplaysModule {}
