import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';
import { CreateTemoignageDto } from './dto/create-temoignage.dto';
import { StatutTemoignage, TemoignagesService } from './temoignages.service';

@Controller('temoignages')
export class TemoignagesController {
  constructor(private readonly service: TemoignagesService) {}

  @Public()
  @Throttle(4, 60)
  @Post()
  create(@Body() dto: CreateTemoignageDto) {
    return this.service.create(dto);
  }

  @Public()
  @Get()
  findApprouves() {
    return this.service.findApprouves();
  }

  // Admin
  @Get('admin/all')
  findAll(@Query('statut') statut?: StatutTemoignage) {
    return this.service.findAll(statut);
  }

  @Patch(':id/moderer')
  moderer(
    @Param('id') id: string,
    @Body('statut') statut: StatutTemoignage,
  ) {
    return this.service.moderer(id, statut);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
