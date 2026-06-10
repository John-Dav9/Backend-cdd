import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface StreamTarget {
  platform: 'youtube' | 'facebook' | 'custom';
  streamKey: string;
  rtmpUrl?: string;
}

const RTMP_URLS: Record<string, string> = {
  youtube: 'rtmp://a.rtmp.youtube.com/live2',
  facebook: 'rtmps://live-api-s.facebook.com:443/rtmp',
};

@Injectable()
export class StreamingService {
  constructor(private config: ConfigService) {}

  async prepareTarget(
    meetingId: string,
    targets: StreamTarget[],
  ): Promise<{ platform: string; rtmpStreamKey: string }> {
    const validTargets = (targets ?? []).filter(target => target?.streamKey?.trim());
    if (!validTargets.length) throw new BadRequestException('Configurez au moins une destination.');
    if (validTargets.length > 1) return this.prepareRelay(meetingId, validTargets);

    const target = validTargets[0];
    const baseUrl = target.rtmpUrl?.trim() || RTMP_URLS[target.platform];
    if (!baseUrl) throw new BadRequestException('Destination RTMP invalide.');
    if (target.platform === 'custom' && !/^rtmps?:\/\//i.test(baseUrl)) {
      throw new BadRequestException('L’adresse RTMP personnalisée est invalide.');
    }

    const separator = baseUrl.endsWith('/') ? '' : '/';
    return {
      platform: target.platform,
      rtmpStreamKey: `${baseUrl}${separator}${target.streamKey.trim()}`,
    };
  }

  async stopRelay(meetingId: string) {
    const controlUrl = this.config.get<string>('STREAM_RELAY_CONTROL_URL')?.trim();
    if (!controlUrl) return;
    await fetch(`${controlUrl.replace(/\/$/, '')}/stop`, {
      method: 'POST',
      headers: this.relayHeaders(),
      body: JSON.stringify({ meetingId }),
    }).catch(() => undefined);
  }

  assertAvailable() {
    const enabled = this.config.get<string>('JIBRI_ENABLED', 'false').toLowerCase() === 'true';
    if (!enabled) {
      throw new BadRequestException(
        'La diffusion Jitsi n’est pas configurée. Activez Jibri sur le serveur.',
      );
    }
  }

  private async prepareRelay(meetingId: string, targets: StreamTarget[]) {
    const relayRtmp = this.config.get<string>('STREAM_RELAY_RTMP_URL')?.trim();
    const controlUrl = this.config.get<string>('STREAM_RELAY_CONTROL_URL')?.trim();
    if (!relayRtmp || !controlUrl) {
      throw new BadRequestException(
        'La diffusion simultanée nécessite un relais RTMP configuré.',
      );
    }
    const destinations = targets.map(target => {
      const baseUrl = target.rtmpUrl?.trim() || RTMP_URLS[target.platform];
      if (!baseUrl) throw new BadRequestException('Destination RTMP invalide.');
      return {
        platform: target.platform,
        url: `${baseUrl.replace(/\/$/, '')}/${target.streamKey.trim()}`,
      };
    });
    const response = await fetch(`${controlUrl.replace(/\/$/, '')}/start`, {
      method: 'POST',
      headers: this.relayHeaders(),
      body: JSON.stringify({ meetingId, destinations }),
    });
    if (!response.ok) throw new BadRequestException('Le relais RTMP a refusé la diffusion.');
    return {
      platform: 'multi',
      rtmpStreamKey: `${relayRtmp.replace(/\/$/, '')}/${meetingId}`,
    };
  }

  private relayHeaders() {
    const secret = this.config.get<string>('STREAM_RELAY_SECRET')?.trim();
    return {
      'Content-Type': 'application/json',
      ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
    };
  }
}
