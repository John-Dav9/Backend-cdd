import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { AdminOnly } from '../auth/roles.decorator';
import { ActualitesService } from './actualites.service';
import { CreateActualiteDto } from './dto/create-actualite.dto';

@Controller('actualites')
export class ActualitesController {
  constructor(private readonly service: ActualitesService) {}

  @Public()
  @Get()
  findPubliees() {
    return this.service.findAll(true);
  }

  // Admin — doit être avant :id pour éviter le conflit de route
  @Get('admin/all')
  @AdminOnly()
  findAll() {
    return this.service.findAll(false);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOnePublic(id);
  }

  @Post()
  @AdminOnly()
  create(@Body() dto: CreateActualiteDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @AdminOnly()
  update(@Param('id') id: string, @Body() dto: Partial<CreateActualiteDto>) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @AdminOnly()
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
