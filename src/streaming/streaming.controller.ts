import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { StreamingService, StreamTarget } from './streaming.service';
import { MeetingGateway } from '../reunions/meeting.gateway';

@Controller('streaming')
export class StreamingController {
  constructor(
    private streamingService: StreamingService,
    private meetingGateway: MeetingGateway,
  ) {}

  @Post('start')
  async start(@Body() body: { meetingId: string; jitsiRoomId: string; targets: StreamTarget[] }) {
    const result = await this.streamingService.startStreaming(body.meetingId, body.jitsiRoomId, body.targets);
    if (result.started) {
      this.meetingGateway.broadcastStreamingStatus(body.meetingId, 'started',
        body.targets.map(t => t.platform).join(', '));
    }
    return result;
  }

  @Post('stop')
  async stop(@Body() body: { meetingId: string }) {
    const result = await this.streamingService.stopStreaming(body.meetingId);
    if (result.stopped) {
      this.meetingGateway.broadcastStreamingStatus(body.meetingId, 'stopped');
    }
    return result;
  }

  @Get(':meetingId/status')
  status(@Param('meetingId') meetingId: string) {
    return {
      active: this.streamingService.isStreaming(meetingId),
      targets: this.streamingService.getActiveTargets(meetingId),
    };
  }
}
