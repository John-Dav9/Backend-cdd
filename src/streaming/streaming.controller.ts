import { Body, ConflictException, Controller, Get, Param, Post } from '@nestjs/common';
import { StreamingService, StreamTarget } from './streaming.service';
import { MeetingGateway } from '../reunions/meeting.gateway';
import { MeetingAdminOnly } from '../auth/roles.decorator';

@MeetingAdminOnly()
@Controller('streaming')
export class StreamingController {
  constructor(
    private streamingService: StreamingService,
    private meetingGateway: MeetingGateway,
  ) {}

  @Post('start')
  async start(@Body() body: { meetingId: string; jitsiRoomId: string; targets: StreamTarget[] }) {
    this.streamingService.assertAvailable();
    const target = await this.streamingService.prepareTarget(body.meetingId, body.targets);
    const sent = this.meetingGateway.sendMediaCommand(body.meetingId, {
      action: 'start',
      mode: 'stream',
      streamKey: target.rtmpStreamKey,
    });
    if (!sent) {
      throw new ConflictException('Aucun modérateur connecté ne peut démarrer la diffusion.');
    }
    return { started: true, status: 'starting', platform: target.platform };
  }

  @Post('stop')
  async stop(@Body() body: { meetingId: string }) {
    const sent = this.meetingGateway.sendMediaCommand(body.meetingId, {
      action: 'stop',
      mode: 'stream',
    });
    if (!sent) {
      throw new ConflictException('Aucun modérateur connecté ne peut arrêter la diffusion.');
    }
    await this.streamingService.stopRelay(body.meetingId);
    return { stopped: true, status: 'stopping' };
  }

  @Get(':meetingId/status')
  status(@Param('meetingId') meetingId: string) {
    return this.meetingGateway.getMediaState(meetingId, 'stream');
  }
}
