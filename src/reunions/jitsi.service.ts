import { Injectable } from '@nestjs/common';
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

  generateRoomId(): string {
    const prefix = 'cmciea';
    const random = Math.random().toString(36).substring(2, 10);
    return `${prefix}-${random}`;
  }

  getJitsiUrl(): string {
    return this.config.get('JITSI_URL', 'https://meet.cmciea-france.com');
  }
}
