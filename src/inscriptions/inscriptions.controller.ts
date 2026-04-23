import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';
import { CreateInscriptionDto, InscriptionType } from './dto/create-inscription.dto';
import { InscriptionsService } from './inscriptions.service';

@Controller('inscriptions')
export class InscriptionsController {
  constructor(private readonly service: InscriptionsService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post()
  create(@Body() dto: CreateInscriptionDto) {
    return this.service.create(dto);
  }

  // Routes admin protégées (token Firebase requis)
  @Get()
  findAll(@Query('type') type?: InscriptionType) {
    return this.service.findAll(type);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
