import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bibliotheque } from '../database/entities/bibliotheque.entity';
import { BibliothequeController } from './bibliotheque.controller';
import { BibliothequeService } from './bibliotheque.service';

@Module({
  imports: [TypeOrmModule.forFeature([Bibliotheque])],
  controllers: [BibliothequeController],
  providers: [BibliothequeService],
})
export class BibliothequeModule {}
