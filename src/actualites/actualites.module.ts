import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Actualite } from '../database/entities/actualite.entity';
import { ActualitesController } from './actualites.controller';
import { ActualitesService } from './actualites.service';

@Module({
  imports: [TypeOrmModule.forFeature([Actualite])],
  controllers: [ActualitesController],
  providers: [ActualitesService],
})
export class ActualitesModule {}
