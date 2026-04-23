import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { AnnoncesService } from './annonces.service';
import { CreateAnnonceDto } from './dto/create-annonce.dto';

@Controller('annonces')
export class AnnoncesController {
  constructor(private readonly service: AnnoncesService) {}

  @Public()
  @Get()
  findPubliees() {
    return this.service.findAll(true);
  }

  // Admin
  @Get('admin')
  findAll() {
    return this.service.findAll(false);
  }

  @Post()
  create(@Body() dto: CreateAnnonceDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateAnnonceDto>) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
