import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { AdminOnly, Roles } from '../auth/roles.decorator';
import { CreateRecordingDto } from './dto/create-recording.dto';
import { ReplaysService } from './replays.service';

@Controller('replays')
@Roles('member', 'admin', 'super_admin')
export class ReplaysController {
  constructor(private readonly service: ReplaysService) {}

  @Get()
  findAllPublic() {
    return this.service.findAllPublic();
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
