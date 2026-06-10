import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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

  @Get('admin/orphaned')
  findOrphaned() {
    return this.service.findOrphaned();
  }

  @Get(':id/inscrits')
  getInscrits(@Param('id') id: string) {
    return this.service.getInscrits(id);
  }

  @Get(':id/inscrits/csv')
  async exportCSV(@Param('id') id: string, @Res() res: any) {
    const rows = await this.service.getInscrits(id);
    const marathon = await this.service.findOne(id);
    const header = ['Rang', 'Nom', 'Email', 'Progression (%)', 'Jalons', 'Streak actuel', 'Streak max', 'Inscription'];
    const lines = rows.map((r: any) => [
      r.rank, r.fullName, r.email, r.progressPercent,
      (r.milestonesReached ?? []).join('|'),
      r.currentStreak ?? 0, r.maxStreak ?? 0,
      r.createdAt?._seconds ? new Date(r.createdAt._seconds * 1000).toLocaleDateString('fr-FR') : '',
    ].join(';'));
    const csv = [header.join(';'), ...lines].join('\n');
    const filename = `${(marathon as any).titre?.replace(/\s+/g, '-').toLowerCase() ?? 'marathon'}-inscrits.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('﻿' + csv); // BOM UTF-8 for Excel
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

  @Post(':id/flyer')
  @UseInterceptors(FileInterceptor('file'))
  uploadFlyer(@Param('id') id: string, @UploadedFile() file: any) {
    return this.service.uploadFlyer(id, file);
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
  @Get(':id/leaderboard')
  getLeaderboard(@Param('id') id: string) {
    return this.service.getLeaderboard(id);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post(':id/inscrire')
  inscrire(@Param('id') id: string, @Body() dto: InscrireMarathonDto) {
    return this.service.inscrire(id, dto);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post(':id/progression')
  mettreAJourProgression(@Param('id') id: string, @Body() dto: UpdateProgressionDto) {
    return this.service.mettreAJourProgression(id, dto);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Get(':id/progression')
  getProgression(@Param('id') id: string, @Query('email') email: string) {
    return this.service.getProgression(id, email);
  }
}
