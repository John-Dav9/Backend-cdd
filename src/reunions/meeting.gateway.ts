import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Member } from '../database/entities/member.entity';
import { User } from '../database/entities/user.entity';
import { MeetingRuntimeState } from '../database/entities/meeting-runtime-state.entity';
import { SpiritualBackground } from '../database/entities/spiritual-background.entity';

export interface SpiritualEvent {
  type: 'verse' | 'lyrics' | 'announcement';
  title?: string;
  content: string;
  author?: string;
  reference?: string; // Pour les versets : "Jean 3:16"
  backgroundId?: string;
}

export interface PollEvent {
  id: string;
  question: string;
  options: string[];
  durationSeconds?: number;
}

export interface PollResult {
  pollId: string;
  results: { option: string; count: number; percent: number }[];
  totalVotes: number;
}

export interface PrayerRequest {
  author: string;
  text: string;
  memberId?: string;
}

export type MediaMode = 'file' | 'stream';
export type MediaStatus = 'idle' | 'starting' | 'active' | 'stopping' | 'failed';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URLS
      ? process.env.FRONTEND_URLS.split(',').map(origin => origin.trim())
      : [process.env.FRONTEND_URL || 'http://localhost:4200'],
  },
  namespace: '/meetings',
})
export class MeetingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MeetingGateway.name);
  // meetingId → Set of socket IDs
  private rooms = new Map<string, Set<string>>();
  // Active polls: meetingId → { poll, votes: Map<authenticated identity, optionIndex> }
  private activePolls = new Map<string, { poll: PollEvent; votes: Map<string, number> }>();
  private activeSpiritualEvents = new Map<string, SpiritualEvent>();
  private mediaStates = new Map<string, Record<MediaMode, { status: MediaStatus; error?: string }>>();

  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(Member) private readonly memberRepo: Repository<Member>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(MeetingRuntimeState)
    private readonly runtimeRepo: Repository<MeetingRuntimeState>,
    @InjectRepository(SpiritualBackground)
    private readonly backgroundRepo: Repository<SpiritualBackground>,
  ) {}

  async handleConnection(client: Socket) {
    const token = this.extractToken(client);
    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const user = await this.jwtService.verifyAsync(token);
      if (user.type === 'visitor' && user.role === 'visitor') {
        user.name = String(user.name ?? 'Visiteur').slice(0, 100);
      } else if (user.type === 'member' && user.role !== 'meeting_moderator') {
        const member = await this.memberRepo.findOne({ where: { id: user.sub } });
        if (!member?.isActive) {
          client.disconnect(true);
          return;
        }
        user.role = member.role;
        user.email = member.email;
        user.name = `${member.firstName} ${member.lastName}`.trim();
      } else if (user.type !== 'member') {
        const admin = await this.userRepo.findOne({ where: { id: user.sub } });
        if (!admin || !['admin', 'super_admin'].includes(admin.role)) {
          client.disconnect(true);
          return;
        }
        user.role = admin.role;
        user.email = admin.email;
        user.name = admin.fullName;
      }
      client.data.user = user;
    } catch {
      client.disconnect(true);
      return;
    }

    this.logger.log(`Client connecté : ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client déconnecté : ${client.id}`);
    for (const [meetingId, sockets] of this.rooms) {
      if (sockets.has(client.id)) {
        sockets.delete(client.id);
        this.broadcastParticipantCount(meetingId);
      }
    }
  }

  @SubscribeMessage('join-meeting')
  async handleJoinMeeting(
    @MessageBody() data: { meetingId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { meetingId } = data;
    if (!meetingId?.trim()) throw new WsException('Réunion invalide.');
    this.requireMeetingScope(client, meetingId);
    client.join(meetingId);
    if (!this.rooms.has(meetingId)) this.rooms.set(meetingId, new Set());
    this.rooms.get(meetingId)!.add(client.id);
    this.broadcastParticipantCount(meetingId);

    // Envoyer le sondage actif s'il y en a un
    await this.restoreRuntimeState(meetingId);
    const activePoll = this.activePolls.get(meetingId);
    if (activePoll) {
      client.emit('poll-started', activePoll.poll);
    }
    const activeSpiritualEvent = this.activeSpiritualEvents.get(meetingId);
    if (activeSpiritualEvent) client.emit('spiritual-event', activeSpiritualEvent);

    return { joined: true, meetingId };
  }

  @SubscribeMessage('leave-meeting')
  handleLeaveMeeting(
    @MessageBody() data: { meetingId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { meetingId } = data;
    this.requireJoined(client, meetingId);
    client.leave(meetingId);
    this.rooms.get(meetingId)?.delete(client.id);
    this.broadcastParticipantCount(meetingId);
    return { left: true };
  }

  // ── Outils spirituels (admin → tous les participants) ──────────────────────

  @SubscribeMessage('show-verse')
  async handleShowVerse(
    @MessageBody() data: { meetingId: string; reference: string; content: string; backgroundId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.requireJoined(client, data.meetingId);
    await this.requireAdmin(client);
    const event = {
      type: 'verse',
      title: data.reference,
      content: data.content,
      reference: data.reference,
      backgroundId: await this.normalizeSpiritualBackground(data.backgroundId),
    } as SpiritualEvent;
    this.activeSpiritualEvents.set(data.meetingId, event);
    await this.persistRuntimeState(data.meetingId);
    this.server.to(data.meetingId).emit('spiritual-event', event);
    return { sent: true };
  }

  @SubscribeMessage('show-lyrics')
  async handleShowLyrics(
    @MessageBody() data: { meetingId: string; title: string; lines: string[]; backgroundId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.requireJoined(client, data.meetingId);
    await this.requireAdmin(client);
    const event = {
      type: 'lyrics',
      title: data.title,
      content: data.lines.join('\n'),
      backgroundId: await this.normalizeSpiritualBackground(data.backgroundId),
    } as SpiritualEvent;
    this.activeSpiritualEvents.set(data.meetingId, event);
    await this.persistRuntimeState(data.meetingId);
    this.server.to(data.meetingId).emit('spiritual-event', event);
    return { sent: true };
  }

  @SubscribeMessage('show-announcement')
  async handleShowAnnouncement(
    @MessageBody() data: { meetingId: string; message: string; backgroundId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.requireJoined(client, data.meetingId);
    await this.requireAdmin(client);
    const event = {
      type: 'announcement',
      title: 'Annonce',
      content: data.message,
      backgroundId: await this.normalizeSpiritualBackground(data.backgroundId),
    } as SpiritualEvent;
    this.activeSpiritualEvents.set(data.meetingId, event);
    await this.persistRuntimeState(data.meetingId);
    this.server.to(data.meetingId).emit('spiritual-event', event);
    return { sent: true };
  }

  @SubscribeMessage('dismiss-spiritual')
  async handleDismissSpiritualEvent(
    @MessageBody() data: { meetingId: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.requireJoined(client, data.meetingId);
    await this.requireAdmin(client);
    this.activeSpiritualEvents.delete(data.meetingId);
    await this.persistRuntimeState(data.meetingId);
    this.server.to(data.meetingId).emit('spiritual-dismissed');
    return { dismissed: true };
  }

  // ── Fil de prière ──────────────────────────────────────────────────────────

  @SubscribeMessage('prayer-request')
  handlePrayerRequest(
    @MessageBody() data: { meetingId: string; author?: string; text: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.requireJoined(client, data.meetingId);
    const text = data.text?.trim();
    if (!text || text.length > 1000) throw new WsException('Sujet de prière invalide.');
    const user = client.data.user;
    this.server.to(data.meetingId).emit('prayer-received', {
      author: user?.email?.split('@')[0] ?? 'Membre',
      text,
      memberId: user?.type === 'member' ? user.sub : undefined,
      id: `${Date.now()}-${client.id.slice(0, 6)}`,
    } as PrayerRequest & { id: string });
    return { sent: true };
  }

  @SubscribeMessage('prayer-joined')
  handlePrayerJoined(
    @MessageBody() data: { meetingId: string; prayerId: string; author: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.requireJoined(client, data.meetingId);
    this.server.to(data.meetingId).emit('prayer-support', {
      prayerId: data.prayerId,
      author: client.data.user?.email?.split('@')[0] ?? 'Membre',
    });
    return { sent: true };
  }

  // ── Sondages en réunion ────────────────────────────────────────────────────

  @SubscribeMessage('start-poll')
  async handleStartPoll(
    @MessageBody() data: { meetingId: string; poll: PollEvent },
    @ConnectedSocket() client: Socket,
  ) {
    this.requireJoined(client, data.meetingId);
    await this.requireAdmin(client);
    if (
      !data.poll?.question?.trim() ||
      !Array.isArray(data.poll.options) ||
      data.poll.options.length < 2 ||
      data.poll.options.length > 6
    ) {
      throw new WsException('Sondage invalide.');
    }
    data.poll.question = data.poll.question.trim().slice(0, 200);
    data.poll.options = data.poll.options.map(option => option.trim().slice(0, 120));
    const poll = { ...data.poll, id: `poll-${Date.now()}` };
    this.activePolls.set(data.meetingId, { poll, votes: new Map() });
    await this.persistRuntimeState(data.meetingId);
    this.server.to(data.meetingId).emit('poll-started', poll);

    // Fermer automatiquement après la durée
    if (poll.durationSeconds) {
      setTimeout(() => void this.closePoll(data.meetingId), poll.durationSeconds * 1000);
    }
    return { started: true, pollId: poll.id };
  }

  @SubscribeMessage('poll-answer')
  async handlePollAnswer(
    @MessageBody() data: { meetingId: string; pollId: string; optionIndex: number },
    @ConnectedSocket() client: Socket,
  ) {
    this.requireJoined(client, data.meetingId);
    const pollData = this.activePolls.get(data.meetingId);
    if (!pollData || pollData.poll.id !== data.pollId) return { error: 'No active poll' };
    if (
      !Number.isInteger(data.optionIndex) ||
      data.optionIndex < 0 ||
      data.optionIndex >= pollData.poll.options.length
    ) {
      throw new WsException('Option de sondage invalide.');
    }

    pollData.votes.set(this.socketIdentity(client), data.optionIndex);
    await this.persistRuntimeState(data.meetingId);
    this.broadcastPollResults(data.meetingId);
    return { voted: true };
  }

  @SubscribeMessage('close-poll')
  async handleClosePoll(
    @MessageBody() data: { meetingId: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.requireJoined(client, data.meetingId);
    await this.requireAdmin(client);
    await this.closePoll(data.meetingId);
    return { closed: true };
  }

  @SubscribeMessage('media-status')
  async handleMediaStatus(
    @MessageBody() data: {
      meetingId: string;
      mode: MediaMode;
      status: MediaStatus;
      error?: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    this.requireJoined(client, data.meetingId);
    await this.requireAdmin(client);
    if (!['file', 'stream'].includes(data.mode)) throw new WsException('Mode média invalide.');
    if (!['idle', 'starting', 'active', 'stopping', 'failed'].includes(data.status)) {
      throw new WsException('État média invalide.');
    }

    const state = this.mediaStates.get(data.meetingId) ?? {
      file: { status: 'idle' as MediaStatus },
      stream: { status: 'idle' as MediaStatus },
    };
    state[data.mode] = {
      status: data.status,
      error: data.error?.slice(0, 300),
    };
    this.mediaStates.set(data.meetingId, state);
    await this.persistRuntimeState(data.meetingId);

    const event = data.mode === 'file' ? 'recording-status' : 'streaming-status';
    this.server.to(data.meetingId).emit(event, {
      status: data.status,
      error: data.error,
    });
    return { updated: true };
  }

  private async closePoll(meetingId: string) {
    const pollData = this.activePolls.get(meetingId);
    if (!pollData) return;

    const results = this.computePollResults(pollData);
    this.server.to(meetingId).emit('poll-closed', results);
    this.activePolls.delete(meetingId);
    await this.persistRuntimeState(meetingId);
  }

  private broadcastPollResults(meetingId: string) {
    const pollData = this.activePolls.get(meetingId);
    if (!pollData) return;
    const results = this.computePollResults(pollData);
    this.server.to(meetingId).emit('poll-results', results);
  }

  private computePollResults(pollData: { poll: PollEvent; votes: Map<string, number> }): PollResult {
    const counts = new Array(pollData.poll.options.length).fill(0);
    for (const idx of pollData.votes.values()) counts[idx]++;
    const total = pollData.votes.size || 1;
    return {
      pollId: pollData.poll.id,
      totalVotes: pollData.votes.size,
      results: pollData.poll.options.map((option, i) => ({
        option,
        count: counts[i],
        percent: Math.round((counts[i] / total) * 100),
      })),
    };
  }

  // ── Broadcast helpers ──────────────────────────────────────────────────────

  broadcastParticipantCount(meetingId: string) {
    const count = this.rooms.get(meetingId)?.size ?? 0;
    this.server.to(meetingId).emit('participant-count', { meetingId, count });
  }

  broadcastMeetingEnded(meetingId: string) {
    this.server.to(meetingId).emit('meeting-ended', { meetingId });
    this.rooms.delete(meetingId);
    this.activePolls.delete(meetingId);
    this.activeSpiritualEvents.delete(meetingId);
    this.mediaStates.delete(meetingId);
    void this.runtimeRepo.delete({ meetingId });
  }

  broadcastMeetingStarted(meetingId: string, title: string) {
    this.server.emit('meeting-started', { meetingId, title });
  }

  broadcastStreamingStatus(meetingId: string, status: 'started' | 'stopped', platform?: string) {
    this.server.to(meetingId).emit('streaming-status', { status, platform });
  }

  async sendMediaCommand(
    meetingId: string,
    command: { action: 'start' | 'stop'; mode: MediaMode; streamKey?: string },
  ): Promise<boolean> {
    await this.restoreRuntimeState(meetingId);
    const moderator = this.findModeratorSocket(meetingId);
    if (!moderator) return false;

    const state = this.mediaStates.get(meetingId) ?? {
      file: { status: 'idle' as MediaStatus },
      stream: { status: 'idle' as MediaStatus },
    };
    state[command.mode] = {
      status: command.action === 'start' ? 'starting' : 'stopping',
    };
    this.mediaStates.set(meetingId, state);
    void this.persistRuntimeState(meetingId);
    moderator.emit('media-command', { meetingId, ...command });
    return true;
  }

  async getMediaState(meetingId: string, mode: MediaMode) {
    await this.restoreRuntimeState(meetingId);
    return this.mediaStates.get(meetingId)?.[mode] ?? { status: 'idle' as MediaStatus };
  }

  private socketIdentity(client: Socket) {
    const user = client.data.user;
    return user?.sub ? `${user.type ?? 'user'}:${user.sub}` : `socket:${client.id}`;
  }

  private async restoreRuntimeState(meetingId: string) {
    if (
      this.activeSpiritualEvents.has(meetingId) ||
      this.activePolls.has(meetingId) ||
      this.mediaStates.has(meetingId)
    ) return;

    const state = await this.runtimeRepo.findOne({ where: { meetingId } });
    if (!state) return;
    if (state.spiritualEvent) {
      this.activeSpiritualEvents.set(meetingId, state.spiritualEvent as SpiritualEvent);
    }
    if (state.activePoll) {
      this.activePolls.set(meetingId, {
        poll: state.activePoll as unknown as PollEvent,
        votes: new Map(Object.entries(state.pollVotes ?? {}).map(
          ([identity, option]) => [identity, Number(option)],
        )),
      });
    }
    if (state.mediaState) {
      this.mediaStates.set(meetingId, state.mediaState as any);
    }
  }

  private async persistRuntimeState(meetingId: string) {
    const activePoll = this.activePolls.get(meetingId);
    await this.runtimeRepo.save({
      meetingId,
      spiritualEvent: this.activeSpiritualEvents.get(meetingId) ?? null,
      activePoll: activePoll?.poll ?? null,
      pollVotes: activePoll ? Object.fromEntries(activePoll.votes) : {},
      mediaState: this.mediaStates.get(meetingId) ?? {},
    });
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken) return authToken;

    const authorization = client.handshake.headers.authorization;
    if (authorization?.startsWith('Bearer ')) return authorization.slice(7);
    return null;
  }

  private async normalizeSpiritualBackground(backgroundId?: string) {
    const slug = backgroundId?.trim().toLowerCase();
    if (!slug || !/^[a-z0-9-]{1,80}$/.test(slug)) return 'ocean';
    const background = await this.backgroundRepo.findOne({
      where: { slug, isActive: true },
      select: ['slug'],
    });
    return background?.slug ?? 'ocean';
  }

  private async requireAdmin(client: Socket): Promise<void> {
    const user = client.data.user;
    if (user?.type === 'member' && user.role !== 'meeting_moderator') {
      const member = await this.memberRepo.findOne({ where: { id: user.sub } });
      user.role = member?.isActive ? member.role : 'member';
    } else if (user?.type !== 'member') {
      const admin = await this.userRepo.findOne({ where: { id: user?.sub } });
      user.role = admin?.role ?? 'user';
    }

    const role = user?.role;
    if (
      role !== 'admin' &&
      role !== 'super_admin' &&
      role !== 'meeting_moderator'
    ) {
      throw new WsException('Action réservée aux modérateurs.');
    }
  }

  private requireJoined(client: Socket, meetingId: string): void {
    this.requireMeetingScope(client, meetingId);
    if (!meetingId || !client.rooms.has(meetingId)) {
      throw new WsException('Vous devez rejoindre la réunion avant cette action.');
    }
  }

  private requireMeetingScope(client: Socket, meetingId: string): void {
    const user = client.data.user;
    if (
      (
        user?.role === 'meeting_moderator' &&
        user.meetingModeratorFor !== meetingId
      ) ||
      (
        user?.meetingAccessFor &&
        user.meetingAccessFor !== meetingId
      )
    ) {
      throw new WsException('Ce lien est limité à une autre réunion.');
    }
  }

  private findModeratorSocket(meetingId: string): Socket | undefined {
    for (const socketId of this.rooms.get(meetingId) ?? []) {
      const socket = this.server.sockets.sockets.get(socketId);
      const role = socket?.data.user?.role;
      if (
        socket &&
        (
          role === 'admin' ||
          role === 'super_admin' ||
          (role === 'meeting_moderator' && socket.data.user?.meetingModeratorFor === meetingId)
        )
      ) return socket;
    }
    return undefined;
  }
}
