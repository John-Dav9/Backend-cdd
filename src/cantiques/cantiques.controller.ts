import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { AdminOnly, MeetingAdminOnly } from '../auth/roles.decorator';
import { CantiquesService } from './cantiques.service';
import { SaveCantiqueDto } from './dto/cantique.dto';

@Controller('cantiques')
export class CantiquesController {
  constructor(private readonly service: CantiquesService) {}

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
