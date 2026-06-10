import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cantique } from '../database/entities/cantique.entity';
import { CantiquesController } from './cantiques.controller';
import { CantiquesService } from './cantiques.service';

@Module({
  imports: [TypeOrmModule.forFeature([Cantique])],
  controllers: [CantiquesController],
  providers: [CantiquesService],
})
export class CantiquesModule {}
