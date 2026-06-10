import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class TokenRevocationService implements OnModuleDestroy {
  private readonly logger = new Logger(TokenRevocationService.name);
  private readonly redis: Redis | null;
  private readonly fallback = new Map<string, number>();

  constructor(config: ConfigService) {
    const redisUrl = config.get<string>('REDIS_URL')?.trim();
    this.redis = redisUrl
      ? new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1, enableOfflineQueue: false })
      : null;
  }

  async revoke(jti: string, expiresAtSeconds: number) {
    const ttl = Math.max(1, expiresAtSeconds - Math.floor(Date.now() / 1000));
    this.fallback.set(jti, Date.now() + ttl * 1000);
    await this.useRedis(redis => redis.set(this.key(jti), '1', 'EX', ttl));
  }

  async isRevoked(jti?: string) {
    if (!jti) return false;
    let revoked = false;
    const usedRedis = await this.useRedis(async redis => {
      revoked = Boolean(await redis.get(this.key(jti)));
    });
    if (usedRedis && revoked) return true;
    const expiresAt = this.fallback.get(jti);
    if (!expiresAt) return false;
    if (expiresAt <= Date.now()) {
      this.fallback.delete(jti);
      return false;
    }
    return true;
  }

  async onModuleDestroy() {
    if (this.redis) await this.redis.quit().catch(() => undefined);
  }

  private key(jti: string) {
    return `revoked_token:${jti}`;
  }

  private async useRedis(action: (redis: Redis) => Promise<any>) {
    if (!this.redis) return false;
    try {
      if (this.redis.status === 'wait') await this.redis.connect();
      await action(this.redis);
      return true;
    } catch (error: any) {
      this.logger.warn(`Redis indisponible pour la révocation: ${error?.message}`);
      return false;
    }
  }
}
