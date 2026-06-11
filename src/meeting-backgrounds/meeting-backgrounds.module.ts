import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpiritualBackground } from '../database/entities/spiritual-background.entity';
import { StorageModule } from '../storage/storage.module';
import { MeetingBackgroundsController } from './meeting-backgrounds.controller';
import { MeetingBackgroundsService } from './meeting-backgrounds.service';

@Module({
  imports: [TypeOrmModule.forFeature([SpiritualBackground]), StorageModule],
  controllers: [MeetingBackgroundsController],
  providers: [MeetingBackgroundsService],
})
export class MeetingBackgroundsModule {}
