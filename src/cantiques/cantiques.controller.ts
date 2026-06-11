import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { AdminOnly, MeetingAdminOnly } from '../auth/roles.decorator';
import { CantiquesService } from './cantiques.service';
import { SaveCantiqueDto } from './dto/cantique.dto';

@Controller('cantiques')
export class CantiquesController {
  constructor(private readonly service: CantiquesService) {}

  @Public()
  @Get('public')
  searchPublic(@Query('q') query?: string) {
    return this.service.search(query);
  }

  @Get()
  @AdminOnly()
  search(@Query('q') query?: string) {
    return this.service.search(query);
  }

  @Get('meeting/:meetingId')
  @MeetingAdminOnly()
  searchForMeeting(
    @Param('meetingId') _meetingId: string,
    @Query('q') query?: string,
  ) {
    return this.service.search(query);
  }

  @Post()
  @AdminOnly()
  create(@Body() dto: SaveCantiqueDto) {
    return this.service.create(dto);
  }

  @Post('import')
  @AdminOnly()
  importMany(
    @Body() body: { items: SaveCantiqueDto[]; rightsConfirmation: string },
  ) {
    return this.service.importMany(body.items, body.rightsConfirmation);
  }

  @Put(':id')
  @AdminOnly()
  update(@Param('id') id: string, @Body() dto: SaveCantiqueDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @AdminOnly()
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
