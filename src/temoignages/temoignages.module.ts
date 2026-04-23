import { Module } from '@nestjs/common';
import { TemoignagesController } from './temoignages.controller';
import { TemoignagesService } from './temoignages.service';

@Module({
  controllers: [TemoignagesController],
  providers: [TemoignagesService],
})
export class TemoignagesModule {}
