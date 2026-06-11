import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { AdminOnly } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';
import { MeetingAccessService } from './meeting-access.service';

@Controller('meeting-access')
export class MeetingAccessController {
  constructor(private readonly service: MeetingAccessService) {}

  @AdminOnly()
  @Post(':meetingId')
  create(@Param('meetingId') meetingId: string, @Body() body: any) {
    return this.service.create(meetingId, body);
  }

  @AdminOnly()
  @Get(':meetingId')
  list(@Param('meetingId') meetingId: string) {
    return this.service.list(meetingId);
  }

  @AdminOnly()
  @Delete(':meetingId/:linkId')
  revoke(@Param('meetingId') meetingId: string, @Param('linkId') linkId: string) {
    return this.service.revoke(meetingId, linkId);
  }

  @Public()
  @Post('accept/token')
  accept(@Body() body: { token: string; displayName: string }) {
    return this.service.accept(body.token, body.displayName);
  }
}
