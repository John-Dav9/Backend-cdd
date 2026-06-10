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

  prepareTarget(targets: StreamTarget[]): { platform: string; rtmpStreamKey: string } {
    const validTargets = (targets ?? []).filter(target => target?.streamKey?.trim());
    if (validTargets.length !== 1) {
      throw new BadRequestException(
        'Jitsi diffuse vers une destination à la fois. Sélectionnez YouTube ou Facebook.',
      );
    }

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

  assertAvailable() {
    const enabled = this.config.get<string>('JIBRI_ENABLED', 'false').toLowerCase() === 'true';
    if (!enabled) {
      throw new BadRequestException(
        'La diffusion Jitsi n’est pas configurée. Activez Jibri sur le serveur.',
      );
    }
  }
}
