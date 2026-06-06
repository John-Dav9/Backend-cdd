import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn, ChildProcess } from 'child_process';

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
  private readonly logger = new Logger(StreamingService.name);
  // meetingId → { process, targets }
  private activeStreams = new Map<string, { process: ChildProcess; targets: StreamTarget[] }>();

  constructor(private config: ConfigService) {}

  async startStreaming(meetingId: string, jitsiRoomId: string, targets: StreamTarget[]): Promise<{ started: boolean; message: string }> {
    if (this.activeStreams.has(meetingId)) {
      return { started: false, message: 'Streaming déjà en cours' };
    }

    const jitsiUrl = this.config.get('JITSI_URL', 'https://meet.cmciea-france.com');
    const sourceUrl = `${jitsiUrl}/${jitsiRoomId}`;

    // Construire la liste des outputs RTMP
    const outputs: string[] = [];
    for (const target of targets) {
      const baseUrl = target.rtmpUrl ?? RTMP_URLS[target.platform];
      if (!baseUrl) continue;
      outputs.push('-f', 'flv', `${baseUrl}/${target.streamKey}`);
    }

    if (outputs.length === 0) {
      return { started: false, message: 'Aucune destination RTMP valide' };
    }

    // Commande FFmpeg : capture l'URL HLS de Jitsi et relaye vers RTMP
    const ffmpegArgs = [
      '-re',
      '-i', sourceUrl,
      '-c:v', 'libx264', '-preset', 'ultrafast', '-b:v', '2500k',
      '-c:a', 'aac', '-b:a', '128k',
      '-f', 'tee',
      ...outputs,
    ];

    this.logger.log(`Démarrage streaming pour réunion ${meetingId}`);

    const proc = spawn('ffmpeg', ffmpegArgs, { stdio: 'pipe' });

    proc.stderr.on('data', (d) => this.logger.debug(`[ffmpeg] ${d}`));
    proc.on('exit', (code) => {
      this.logger.log(`[ffmpeg] exit code ${code} pour ${meetingId}`);
      this.activeStreams.delete(meetingId);
    });

    this.activeStreams.set(meetingId, { process: proc, targets });
    return { started: true, message: `Streaming démarré vers ${targets.map(t => t.platform).join(', ')}` };
  }

  async stopStreaming(meetingId: string): Promise<{ stopped: boolean; message: string }> {
    const stream = this.activeStreams.get(meetingId);
    if (!stream) return { stopped: false, message: 'Aucun streaming en cours' };

    stream.process.kill('SIGTERM');
    this.activeStreams.delete(meetingId);
    return { stopped: true, message: 'Streaming arrêté' };
  }

  isStreaming(meetingId: string): boolean {
    return this.activeStreams.has(meetingId);
  }

  getActiveTargets(meetingId: string): StreamTarget[] {
    return this.activeStreams.get(meetingId)?.targets ?? [];
  }
}
