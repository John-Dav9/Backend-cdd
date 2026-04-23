import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';
import { MarathonService } from './marathon.service';
import { CreateMarathonDto } from './dto/create-marathon.dto';
import { InscrireMarathonDto } from './dto/inscrire-marathon.dto';
import { UpdateProgressionDto } from './dto/update-progression.dto';

@Controller('marathon')
export class MarathonController {
  constructor(private readonly service: MarathonService) {}

  // ─── Admin (protégé) ──────────────────────────────────────────────────────

  @Post()
  creer(@Body() dto: CreateMarathonDto) {
    return this.service.creer(dto);
  }

  @Get('admin/all')
  findAllAdmin() {
    return this.service.findAll(true);
  }

  @Get(':id/inscrits')
  getInscrits(@Param('id') id: string) {
    return this.service.getInscrits(id);
  }

  @Patch(':id/archiver')
  archiver(@Param('id') id: string) {
    return this.service.archiver(id);
  }

  @Patch(':id/reactiver')
  reactiver(@Param('id') id: string) {
    return this.service.reactiver(id);
  }

  @Delete(':id')
  supprimer(@Param('id') id: string) {
    return this.service.supprimer(id);
  }

  @Post('attestations-annuelles')
  attestationsAnnuelles(@Body('annee') annee: number) {
    return this.service.envoyerAttestationsAnnuelles(annee);
  }

  // ─── Public ───────────────────────────────────────────────────────────────

  @Public()
  @Get()
  findAll() {
    return this.service.findAll(false);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Public()
  @Throttle(5, 60)
  @Post(':id/inscrire')
  inscrire(@Param('id') id: string, @Body() dto: InscrireMarathonDto) {
    return this.service.inscrire(id, dto);
  }

  @Public()
  @Throttle(20, 60)
  @Post(':id/progression')
  mettreAJourProgression(@Param('id') id: string, @Body() dto: UpdateProgressionDto) {
    return this.service.mettreAJourProgression(id, dto);
  }

  @Public()
  @Throttle(30, 60)
  @Get(':id/progression')
  getProgression(@Param('id') id: string, @Query('email') email: string) {
    return this.service.getProgression(id, email);
  }
}
