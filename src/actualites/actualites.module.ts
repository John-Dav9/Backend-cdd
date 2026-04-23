import { Module } from '@nestjs/common';
import { ActualitesController } from './actualites.controller';
import { ActualitesService } from './actualites.service';

@Module({
  controllers: [ActualitesController],
  providers: [ActualitesService],
})
export class ActualitesModule {}
