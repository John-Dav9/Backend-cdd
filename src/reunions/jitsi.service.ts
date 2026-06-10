import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JitsiService {
  constructor(private config: ConfigService) {}

  generateToken(roomId: string, user: { id: string; firstName: string; lastName: string; email: string }, isModerator: boolean): string {
    const appId = this.config.get('JITSI_APP_ID', 'cmciea-france');
    const secret = this.config.get('JITSI_APP_SECRET', this.config.get('JWT_SECRET'));
    const jitsiUrl = this.config.get('JITSI_URL', 'https://meet.cmciea-france.com');
    const domain = jitsiUrl.replace('https://', '').replace('http://', '');

    const payload = {
      iss: appId,
      aud: appId,
      sub: domain,
      room: roomId,
      moderator: isModerator,
      context: {
        user: {
          id: user.id,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          moderator: isModerator,
        },
        features: {
          livestreaming: isModerator,
          recording: isModerator,
          'screen-sharing': true,
          outbound_call: false,
        },
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const jwt = require('jsonwebtoken');
    return jwt.sign(payload, secret, { expiresIn: '4h', algorithm: 'HS256' });
  }

  assertJibriAvailable(): void {
    const enabled = this.config.get<string>('JIBRI_ENABLED', 'false').toLowerCase() === 'true';
    if (!enabled) {
      throw new ServiceUnavailableException(
        'L’enregistrement Jitsi n’est pas configuré sur le serveur. Activez Jibri avant de lancer cette fonction.',
      );
    }
  }

  async muteParticipant(roomId: string, participantId: string): Promise<void> {
    const jicofoUrl = this.config.get<string>('JITSI_JICOFO_URL');
    if (!jicofoUrl) return;
    try {
      await fetch(`${jicofoUrl}/colibri/conferences/${roomId}/participants/${participantId}/mute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: true }),
      });
    } catch { /* silently fail — la commande Jitsi côté client suffit */ }
  }

  async kickParticipant(roomId: string, participantId: string): Promise<void> {
    const jicofoUrl = this.config.get<string>('JITSI_JICOFO_URL');
    if (!jicofoUrl) return;
    try {
      await fetch(`${jicofoUrl}/colibri/conferences/${roomId}/participants/${participantId}`, {
        method: 'DELETE',
      });
    } catch { /* silently fail */ }
  }

  async grantModerator(roomId: string, participantId: string): Promise<void> {
    const jicofoUrl = this.config.get<string>('JITSI_JICOFO_URL');
    if (!jicofoUrl) return;
    try {
      await fetch(`${jicofoUrl}/colibri/conferences/${roomId}/participants/${participantId}/role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'moderator' }),
      });
    } catch { /* silently fail */ }
  }

  generateRoomId(): string {
    const prefix = 'cmciea';
    const random = Math.random().toString(36).substring(2, 10);
    return `${prefix}-${random}`;
  }

  getJitsiUrl(): string {
    return this.config.get('JITSI_URL', 'https://meet.cmciea-france.com');
  }
}
