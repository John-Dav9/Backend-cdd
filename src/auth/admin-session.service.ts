import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface AdminMeetingSession {
  meetingId: string;
  participantId: string;
  userId: string;
  role: string;
  jitsiParticipantId?: string;
}

@Injectable()
export class AdminSessionService implements OnModuleDestroy {
  private readonly logger = new Logger(AdminSessionService.name);
  private readonly ttlSeconds: number;
  private readonly redis: Redis | null;
  private readonly fallback = new Map<string, { value: AdminMeetingSession; expiresAt: number }>();

  constructor(config: ConfigService) {
    this.ttlSeconds = Number(config.get('ADMIN_SESSION_TTL_SECONDS', 300));
    const redisUrl = config.get<string>('REDIS_URL')?.trim();
    this.redis = redisUrl
      ? new Redis(redisUrl, {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
        })
      : null;
    if (!redisUrl) this.logger.warn('REDIS_URL absent: sessions admin conservées en mémoire locale.');
  }

  async save(session: AdminMeetingSession) {
    const key = this.key(session.meetingId, session.participantId);
    this.fallback.set(key, {
      value: session,
      expiresAt: Date.now() + this.ttlSeconds * 1000,
    });
    await this.useRedis(redis => redis.set(key, JSON.stringify(session), 'EX', this.ttlSeconds));
  }

  async refresh(meetingId: string, participantId: string) {
    const key = this.key(meetingId, participantId);
    const entry = this.fallback.get(key);
    if (entry) entry.expiresAt = Date.now() + this.ttlSeconds * 1000;
    await this.useRedis(redis => redis.expire(key, this.ttlSeconds));
  }

  async get(meetingId: string, participantId: string) {
    const key = this.key(meetingId, participantId);
    let raw: string | null = null;
    const usedRedis = await this.useRedis(async redis => {
      raw = await redis.get(key);
      return true;
    });
    if (usedRedis && raw) return JSON.parse(raw) as AdminMeetingSession;

    const entry = this.fallback.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.fallback.delete(key);
      return null;
    }
    return entry.value;
  }

  async remove(meetingId: string, participantId: string) {
    const key = this.key(meetingId, participantId);
    await this.useRedis(redis => redis.del(key));
    this.fallback.delete(key);
  }

  async onModuleDestroy() {
    if (this.redis) await this.redis.quit().catch(() => undefined);
  }

  private key(meetingId: string, participantId: string) {
    return `admin_session:${meetingId}:${participantId}`;
  }

  private async useRedis(action: (redis: Redis) => Promise<any>): Promise<boolean> {
    if (!this.redis) return false;
    try {
      if (this.redis.status === 'wait') await this.redis.connect();
      await action(this.redis);
      return true;
    } catch (error: any) {
      this.logger.warn(`Redis indisponible, repli mémoire: ${error?.message}`);
      return false;
    }
  }
}
