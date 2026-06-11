import { Body, ConflictException, Controller, Delete, Get, Param, Post, Put, Query, Request } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { AdminOnly, MeetingAdminOnly, Roles } from '../auth/roles.decorator';
import { AdmissionStatusDto, CreateReunionDto, JoinReunionDto, UpdateReunionDto } from './dto/reunions.dto';
import { ReunionsService } from './reunions.service';
import { MeetingGateway } from './meeting.gateway';
import { JitsiService } from './jitsi.service';

@Controller('reunions')
export class ReunionsController {
  constructor(
    private reunionsService: ReunionsService,
    private meetingGateway: MeetingGateway,
    private jitsiService: JitsiService,
  ) {}

  @Public()
  @Get()
  findAll() {
    return this.reunionsService.findAll();
  }

  @Get('admin/all')
  @AdminOnly()
  findAllAdmin() {
    return this.reunionsService.findAllAdmin();
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

  @Public()
  @Get('calendar')
  findCalendar(@Query('from') from: string, @Query('to') to: string) {
    return this.reunionsService.findCalendar(from, to);
  }

  @Public()
  @Get('capabilities')
  capabilities() {
    return this.jitsiService.getCapabilities();
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.reunionsService.findOnePublic(id);
  }

  @Post()
  @AdminOnly()
  create(@Body() dto: CreateReunionDto, @Request() req: any) {
    const memberId = req.user.type === 'member' ? req.user.sub : null;
    return this.reunionsService.create(dto, memberId);
  }

  @Put(':id')
  @AdminOnly()
  update(@Param('id') id: string, @Body() dto: UpdateReunionDto) {
    return this.reunionsService.update(id, dto);
  }

  @Delete(':id')
  @AdminOnly()
  remove(@Param('id') id: string) {
    return this.reunionsService.remove(id);
  }

  @Post(':id/join')
  @Roles('visitor', 'member', 'meeting_moderator', 'admin', 'super_admin')
  join(@Param('id') id: string, @Body() dto: JoinReunionDto, @Request() req: any) {
    return this.reunionsService.join(id, req.user.sub, dto, req.user);
  }

  @Post(':id/admission/status')
  @Roles('visitor', 'member', 'meeting_moderator', 'admin', 'super_admin')
  admissionStatus(
    @Param('id') id: string,
    @Body() dto: AdmissionStatusDto,
    @Request() req: any,
  ) {
    return this.reunionsService.getAdmissionStatus(id, dto.participantId, req.user);
  }

  @Get(':id/waiting-participants')
  @MeetingAdminOnly()
  getWaitingParticipants(@Param('id') id: string) {
    return this.reunionsService.getWaitingParticipants(id);
  }

  @Post(':id/admit/:participantId')
  @MeetingAdminOnly()
  admitParticipant(@Param('id') id: string, @Param('participantId') participantId: string) {
    return this.reunionsService.admitParticipant(id, participantId);
  }

  @Post(':id/reject/:participantId')
  @MeetingAdminOnly()
  rejectParticipant(@Param('id') id: string, @Param('participantId') participantId: string) {
    return this.reunionsService.rejectParticipant(id, participantId);
  }

  @Post(':id/end')
  @MeetingAdminOnly()
  async end(@Param('id') id: string) {
    const result = await this.reunionsService.end(id);
    this.meetingGateway.broadcastMeetingEnded(id);
    return result;
  }

  @Post(':id/record/start')
  @MeetingAdminOnly()
  async startRecording(@Param('id') id: string) {
    await this.reunionsService.findOne(id);
    this.jitsiService.assertJibriAvailable();
    if (!await this.meetingGateway.sendMediaCommand(id, { action: 'start', mode: 'file' })) {
      throw new ConflictException('Aucun modérateur connecté ne peut démarrer l’enregistrement.');
    }
    return { status: 'starting', message: 'Démarrage de l’enregistrement demandé.' };
  }

  @Post(':id/record/stop')
  @MeetingAdminOnly()
  async stopRecording(@Param('id') id: string) {
    await this.reunionsService.findOne(id);
    if (!await this.meetingGateway.sendMediaCommand(id, { action: 'stop', mode: 'file' })) {
      throw new ConflictException('Aucun modérateur connecté ne peut arrêter l’enregistrement.');
    }
    return { status: 'stopping', message: 'Arrêt de l’enregistrement demandé.' };
  }

  @Get(':id/record/status')
  @MeetingAdminOnly()
  async recordingStatus(@Param('id') id: string) {
    return this.meetingGateway.getMediaState(id, 'file');
  }

  @Post(':id/heartbeat')
  @Roles('visitor', 'member', 'meeting_moderator', 'admin', 'super_admin')
  heartbeat(
    @Param('id') id: string,
    @Body('participantId') participantId: string,
    @Request() req: any,
  ) {
    return this.reunionsService.heartbeat(id, participantId, req.user);
  }

  @Post(':id/participant-session')
  @Roles('visitor', 'member', 'meeting_moderator', 'admin', 'super_admin')
  registerParticipantSession(
    @Param('id') id: string,
    @Body() body: { participantId: string; jitsiParticipantId: string },
    @Request() req: any,
  ) {
    return this.reunionsService.registerJitsiParticipant(
      id,
      body.participantId,
      body.jitsiParticipantId,
      req.user,
    );
  }

  @Post(':id/reconnect')
  @Roles('visitor', 'member', 'meeting_moderator', 'admin', 'super_admin')
  reconnect(@Param('id') id: string, @Body('token') token: string, @Request() req: any) {
    return this.reunionsService.reconnect(id, req.user, token);
  }

  @Get(':id/participants')
  @MeetingAdminOnly()
  getParticipants(@Param('id') id: string) {
    return this.reunionsService.getParticipants(id);
  }

  @Get(':id/attendance')
  @MeetingAdminOnly()
  getAttendance(@Param('id') id: string) {
    return this.reunionsService.getAttendance(id);
  }

  @Post(':id/send-reminders')
  @MeetingAdminOnly()
  sendReminders(@Param('id') id: string) {
    return this.reunionsService.sendReminders(id);
  }

  @Post(':id/mute/:participantJitsiId')
  @MeetingAdminOnly()
  muteParticipant(@Param('id') id: string, @Param('participantJitsiId') participantJitsiId: string) {
    return this.reunionsService.muteParticipant(id, participantJitsiId);
  }

  @Post(':id/kick/:participantId')
  @MeetingAdminOnly()
  kickParticipant(@Param('id') id: string, @Param('participantId') participantId: string) {
    return this.reunionsService.kickParticipant(id, participantId);
  }

  @Post(':id/grant-moderator/:memberId')
  @MeetingAdminOnly()
  grantModerator(@Param('id') id: string, @Param('memberId') memberId: string) {
    return this.reunionsService.grantModerator(id, memberId);
  }

  @Post(':id/invitations')
  @AdminOnly()
  createModeratorInvite(@Param('id') id: string, @Body('memberId') memberId: string) {
    return this.reunionsService.createModeratorInvite(id, memberId);
  }

  @Get(':id/invitations')
  @AdminOnly()
  listModeratorInvites(@Param('id') id: string) {
    return this.reunionsService.listModeratorInvites(id);
  }

  @Delete(':id/invitations/:inviteId')
  @AdminOnly()
  revokeModeratorInvite(@Param('id') id: string, @Param('inviteId') inviteId: string) {
    return this.reunionsService.revokeModeratorInvite(id, inviteId);
  }

  @Public()
  @Post('invitations/accept')
  acceptModeratorInvite(@Body('token') token: string) {
    return this.reunionsService.acceptModeratorInvite(token);
  }
}
