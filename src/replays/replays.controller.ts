import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query, Req, Res, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { AdminOnly, Roles } from '../auth/roles.decorator';
import { CreateRecordingDto } from './dto/create-recording.dto';
import { ReplaysService } from './replays.service';
import { ConfigService } from '@nestjs/config';
import { Public } from '../auth/public.decorator';

@Controller('replays')
@Roles('member', 'admin', 'super_admin')
export class ReplaysController {
  constructor(private readonly service: ReplaysService, private readonly config: ConfigService) {}

  @Get()
  findAllPublic(@Query('limit') limit?: string) {
    return this.service.findAllPublic(limit ? parseInt(limit, 10) : undefined);
  }

  // Admin — avant :id pour éviter conflit de route
  @Get('admin/all')
  @AdminOnly()
  findAllAdmin() {
    return this.service.findAllAdmin();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOnePublic(id);
  }

  @Post()
  @AdminOnly()
  create(@Body() dto: CreateRecordingDto) {
    return this.service.create(dto);
  }

  @Public()
  @Post('jibri/finalize')
  finalizeJibri(@Req() req: Request, @Body() body: { recordingPath: string; roomId: string }) {
    const expected = this.config.get<string>('JIBRI_FINALIZE_SECRET')?.trim();
    if (!expected || req.headers['x-jibri-secret'] !== expected) {
      throw new UnauthorizedException('Signature Jibri invalide');
    }
    return this.service.finalizeJibri(body.recordingPath, body.roomId);
  }

  @Get(':id/download')
  @AdminOnly()
  async download(@Param('id') id: string, @Res() res: Response) {
    const { stream, filename } = await this.service.getDownloadStream(id);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'video/mp4');
    (stream as any).pipe(res);
  }

  @Patch(':id')
  @AdminOnly()
  update(@Param('id') id: string, @Body() dto: Partial<CreateRecordingDto>) {
    return this.service.update(id, dto);
  }

  @Patch(':id/toggle-public')
  @AdminOnly()
  togglePublic(@Param('id') id: string) {
    return this.service.togglePublic(id);
  }

  @Delete(':id')
  @AdminOnly()
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/summarize')
  summarize(@Param('id') id: string) {
    return this.service.summarize(id);
  }

  @Get(':id/recommendations')
  getRecommendations(@Param('id') id: string) {
    return this.service.getPublicRecommendations(id);
  }

  @Get('podcast/feed.xml')
  @Header('Content-Type', 'application/rss+xml; charset=utf-8')
  async getPodcast(@Req() req: Request) {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return this.service.getPodcastFeed(baseUrl);
  }
}
