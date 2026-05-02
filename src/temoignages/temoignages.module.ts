import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Temoignage } from '../database/entities/temoignage.entity';
import { TemoignagesController } from './temoignages.controller';
import { TemoignagesService } from './temoignages.service';

@Module({
  imports: [TypeOrmModule.forFeature([Temoignage])],
  controllers: [TemoignagesController],
  providers: [TemoignagesService],
})
export class TemoignagesModule {}
