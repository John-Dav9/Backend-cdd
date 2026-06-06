import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../auth/public.decorator';
import { CreateRecordingDto } from './dto/create-recording.dto';
import { ReplaysService } from './replays.service';

@Controller('replays')
export class ReplaysController {
  constructor(private readonly service: ReplaysService) {}

  @Public()
  @Get()
  findAllPublic() {
    return this.service.findAllPublic();
  }

  // Admin — avant :id pour éviter conflit de route
  @Get('admin/all')
  findAllAdmin() {
    return this.service.findAllAdmin();
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateRecordingDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateRecordingDto>) {
    return this.service.update(id, dto);
  }

  @Patch(':id/toggle-public')
  togglePublic(@Param('id') id: string) {
    return this.service.togglePublic(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/summarize')
  summarize(@Param('id') id: string) {
    return this.service.summarize(id);
  }

  @Public()
  @Get(':id/recommendations')
  getRecommendations(@Param('id') id: string) {
    return this.service.getRecommendations(id);
  }

  @Public()
  @Get('podcast/feed.xml')
  @Header('Content-Type', 'application/rss+xml; charset=utf-8')
  async getPodcast(@Req() req: Request) {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return this.service.getPodcastFeed(baseUrl);
  }
}
