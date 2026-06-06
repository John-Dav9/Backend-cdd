import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CellGroup } from '../database/entities/cell-group.entity';
import { CellGroupsController } from './cell-groups.controller';
import { CellGroupsService } from './cell-groups.service';

@Module({
  imports: [TypeOrmModule.forFeature([CellGroup])],
  controllers: [CellGroupsController],
  providers: [CellGroupsService],
  exports: [CellGroupsService],
})
export class CellGroupsModule {}
