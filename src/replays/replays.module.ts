import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Recording } from '../database/entities/recording.entity';
import { ReplaysController } from './replays.controller';
import { ReplaysService } from './replays.service';

@Module({
  imports: [TypeOrmModule.forFeature([Recording])],
  controllers: [ReplaysController],
  providers: [ReplaysService],
  exports: [ReplaysService],
})
export class ReplaysModule {}
