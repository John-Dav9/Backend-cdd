import { Body, Controller, Get, Param, Patch, Post, Request } from '@nestjs/common';
import { AdminOnly, Roles } from '../auth/roles.decorator';
import { MentorshipService } from './mentorship.service';

@Controller('mentorship')
export class MentorshipController {
  constructor(private readonly service: MentorshipService) {}

  @Post()
  @Roles('member', 'admin', 'super_admin')
  create(@Request() req: any, @Body() body: { topic: string; message: string }) {
    return this.service.create(req.user.sub, body);
  }

  @Get('mine')
  @Roles('member', 'admin', 'super_admin')
  mine(@Request() req: any) {
    return this.service.findMine(req.user.sub);
  }

  @Get()
  @AdminOnly()
  findAll() {
    return this.service.findAll();
  }

  @Patch(':id/assign')
  @AdminOnly()
  assign(@Param('id') id: string, @Body('mentorId') mentorId: string) {
    return this.service.assign(id, mentorId);
  }

  @Patch(':id/status')
  @AdminOnly()
  updateStatus(@Param('id') id: string, @Body('status') status: 'pending' | 'assigned' | 'closed') {
    return this.service.updateStatus(id, status);
  }
}
