import { Body, Controller, Delete, Get, Param, Post, Put, Request } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { CreateReunionDto, JoinReunionDto, UpdateReunionDto } from './dto/reunions.dto';
import { ReunionsService } from './reunions.service';

@Controller('reunions')
export class ReunionsController {
  constructor(private reunionsService: ReunionsService) {}

  @Public()
  @Get()
  findAll() {
    return this.reunionsService.findAll();
  }

  @Public()
  @Get('current')
  findCurrent() {
    return this.reunionsService.findCurrent();
  }

  @Public()
  @Get('upcoming')
  findUpcoming() {
    return this.reunionsService.findUpcoming();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.reunionsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateReunionDto, @Request() req: any) {
    const memberId = req.user.type === 'member' ? req.user.sub : null;
    return this.reunionsService.create(dto, memberId);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateReunionDto) {
    return this.reunionsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.reunionsService.remove(id);
  }

  @Post(':id/join')
  join(@Param('id') id: string, @Body() dto: JoinReunionDto, @Request() req: any) {
    return this.reunionsService.join(id, req.user.sub, dto, req.user);
  }

  @Post(':id/end')
  end(@Param('id') id: string) {
    return this.reunionsService.end(id);
  }

  @Post(':id/heartbeat')
  heartbeat(@Param('id') id: string, @Request() req: any) {
    return this.reunionsService.heartbeat(id, req.user.sub);
  }

  @Post(':id/reconnect')
  reconnect(@Param('id') id: string, @Body('token') token: string, @Request() req: any) {
    return this.reunionsService.reconnect(id, req.user.sub, token);
  }

  @Get(':id/participants')
  getParticipants(@Param('id') id: string) {
    return this.reunionsService.getParticipants(id);
  }

  @Post(':id/send-reminders')
  sendReminders(@Param('id') id: string) {
    return this.reunionsService.sendReminders(id);
  }
}
