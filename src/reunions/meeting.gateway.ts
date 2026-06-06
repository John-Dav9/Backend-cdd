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

  handleConnection(client: Socket) {
    this.logger.log(`Client connecté : ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client déconnecté : ${client.id}`);
    // Retirer le client de toutes les salles
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

  broadcastParticipantCount(meetingId: string) {
    const count = this.rooms.get(meetingId)?.size ?? 0;
    this.server.to(meetingId).emit('participant-count', { meetingId, count });
  }

  broadcastMeetingEnded(meetingId: string) {
    this.server.to(meetingId).emit('meeting-ended', { meetingId });
    this.rooms.delete(meetingId);
  }

  broadcastMeetingStarted(meetingId: string, title: string) {
    this.server.emit('meeting-started', { meetingId, title });
  }
}
