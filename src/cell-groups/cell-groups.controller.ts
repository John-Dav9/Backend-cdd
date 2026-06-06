import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { CellGroupsService } from './cell-groups.service';

@Controller('cell-groups')
export class CellGroupsController {
  constructor(private service: CellGroupsService) {}

  @Public()
  @Get()
  findAll() { return this.service.findAll(); }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  create(@Body() dto: any) { return this.service.create(dto); }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: any) { return this.service.update(id, dto); }

  @Post(':id/members/:memberId')
  addMember(@Param('id') id: string, @Param('memberId') memberId: string) {
    return this.service.addMember(id, memberId);
  }

  @Delete(':id/members/:memberId')
  removeMember(@Param('id') id: string, @Param('memberId') memberId: string) {
    return this.service.removeMember(id, memberId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
