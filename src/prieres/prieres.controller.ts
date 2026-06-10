import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';
import { AdminOnly } from '../auth/roles.decorator';
import { CreatePriereDto } from './dto/create-priere.dto';
import { PrieresService, PriereStatut } from './prieres.service';

@Controller('prieres')
export class PrieresController {
  constructor(private readonly service: PrieresService) {}

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post()
  soumettre(@Body() body: CreatePriereDto) {
    return this.service.soumettre(body);
  }

  @Get()
  @AdminOnly()
  findAll() {
    return this.service.findAll();
  }

  @Patch(':id/statut')
  @AdminOnly()
  updateStatut(@Param('id') id: string, @Body('statut') statut: PriereStatut) {
    return this.service.updateStatut(id, statut);
  }

  @Delete(':id')
  @AdminOnly()
  supprimer(@Param('id') id: string) {
    return this.service.supprimer(id);
  }
}
