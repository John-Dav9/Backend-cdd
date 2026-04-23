import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
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

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  // Admin
  @Get('admin/all')
  findAll() {
    return this.service.findAll(false);
  }

  @Post()
  create(@Body() dto: CreateActualiteDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateActualiteDto>) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
