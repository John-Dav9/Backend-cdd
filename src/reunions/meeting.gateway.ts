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

export interface SpiritualEvent {
  type: 'verse' | 'lyrics' | 'announcement';
  title?: string;
  content: string;
  author?: string;
  reference?: string; // Pour les versets : "Jean 3:16"
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

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/meetings',
})
export class MeetingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MeetingGateway.name);
  // meetingId → Set of socket IDs
  private rooms = new Map<string, Set<string>>();
  // Active polls: meetingId → { poll, votes: Map<socketId, optionIndex> }
  private activePolls = new Map<string, { poll: PollEvent; votes: Map<string, number> }>();

  handleConnection(client: Socket) {
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
  handleJoinMeeting(
    @MessageBody() data: { meetingId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { meetingId } = data;
    client.join(meetingId);
    if (!this.rooms.has(meetingId)) this.rooms.set(meetingId, new Set());
    this.rooms.get(meetingId)!.add(client.id);
    this.broadcastParticipantCount(meetingId);

    // Envoyer le sondage actif s'il y en a un
    const activePoll = this.activePolls.get(meetingId);
    if (activePoll) {
      client.emit('poll-started', activePoll.poll);
    }

    return { joined: true, meetingId };
  }

  @SubscribeMessage('leave-meeting')
  handleLeaveMeeting(
    @MessageBody() data: { meetingId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { meetingId } = data;
    client.leave(meetingId);
    this.rooms.get(meetingId)?.delete(client.id);
    this.broadcastParticipantCount(meetingId);
    return { left: true };
  }

  // ── Outils spirituels (admin → tous les participants) ──────────────────────

  @SubscribeMessage('show-verse')
  handleShowVerse(
    @MessageBody() data: { meetingId: string; reference: string; content: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.server.to(data.meetingId).emit('spiritual-event', {
      type: 'verse',
      title: data.reference,
      content: data.content,
      reference: data.reference,
    } as SpiritualEvent);
    return { sent: true };
  }

  @SubscribeMessage('show-lyrics')
  handleShowLyrics(
    @MessageBody() data: { meetingId: string; title: string; lines: string[] },
    @ConnectedSocket() client: Socket,
  ) {
    this.server.to(data.meetingId).emit('spiritual-event', {
      type: 'lyrics',
      title: data.title,
      content: data.lines.join('\n'),
    } as SpiritualEvent);
    return { sent: true };
  }

  @SubscribeMessage('show-announcement')
  handleShowAnnouncement(
    @MessageBody() data: { meetingId: string; message: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.server.to(data.meetingId).emit('spiritual-event', {
      type: 'announcement',
      title: 'Annonce',
      content: data.message,
    } as SpiritualEvent);
    return { sent: true };
  }

  @SubscribeMessage('dismiss-spiritual')
  handleDismissSpiritualEvent(
    @MessageBody() data: { meetingId: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.server.to(data.meetingId).emit('spiritual-dismissed');
    return { dismissed: true };
  }

  // ── Fil de prière ──────────────────────────────────────────────────────────

  @SubscribeMessage('prayer-request')
  handlePrayerRequest(
    @MessageBody() data: { meetingId: string; author: string; text: string; memberId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.server.to(data.meetingId).emit('prayer-received', {
      author: data.author,
      text: data.text,
      memberId: data.memberId,
      id: `${Date.now()}-${client.id.slice(0, 6)}`,
    } as PrayerRequest & { id: string });
    return { sent: true };
  }

  @SubscribeMessage('prayer-joined')
  handlePrayerJoined(
    @MessageBody() data: { meetingId: string; prayerId: string; author: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.server.to(data.meetingId).emit('prayer-support', {
      prayerId: data.prayerId,
      author: data.author,
    });
    return { sent: true };
  }

  // ── Sondages en réunion ────────────────────────────────────────────────────

  @SubscribeMessage('start-poll')
  handleStartPoll(
    @MessageBody() data: { meetingId: string; poll: PollEvent },
    @ConnectedSocket() client: Socket,
  ) {
    const poll = { ...data.poll, id: `poll-${Date.now()}` };
    this.activePolls.set(data.meetingId, { poll, votes: new Map() });
    this.server.to(data.meetingId).emit('poll-started', poll);

    // Fermer automatiquement après la durée
    if (poll.durationSeconds) {
      setTimeout(() => this.closePoll(data.meetingId), poll.durationSeconds * 1000);
    }
    return { started: true, pollId: poll.id };
  }

  @SubscribeMessage('poll-answer')
  handlePollAnswer(
    @MessageBody() data: { meetingId: string; pollId: string; optionIndex: number },
    @ConnectedSocket() client: Socket,
  ) {
    const pollData = this.activePolls.get(data.meetingId);
    if (!pollData || pollData.poll.id !== data.pollId) return { error: 'No active poll' };

    pollData.votes.set(client.id, data.optionIndex);
    this.broadcastPollResults(data.meetingId);
    return { voted: true };
  }

  @SubscribeMessage('close-poll')
  handleClosePoll(
    @MessageBody() data: { meetingId: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.closePoll(data.meetingId);
    return { closed: true };
  }

  private closePoll(meetingId: string) {
    const pollData = this.activePolls.get(meetingId);
    if (!pollData) return;

    const results = this.computePollResults(pollData);
    this.server.to(meetingId).emit('poll-closed', results);
    this.activePolls.delete(meetingId);
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
  }

  broadcastMeetingStarted(meetingId: string, title: string) {
    this.server.emit('meeting-started', { meetingId, title });
  }

  broadcastStreamingStatus(meetingId: string, status: 'started' | 'stopped', platform?: string) {
    this.server.to(meetingId).emit('streaming-status', { status, platform });
  }
}
