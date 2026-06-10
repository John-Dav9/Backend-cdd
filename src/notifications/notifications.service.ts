import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as webPush from 'web-push';
import { PushSubscriptionEntity } from '../database/entities/push-subscription.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly publicKey: string;
  private readonly enabled: boolean;

  constructor(
    @InjectRepository(PushSubscriptionEntity)
    private readonly repo: Repository<PushSubscriptionEntity>,
    config: ConfigService,
  ) {
    this.publicKey = config.get<string>('VAPID_PUBLIC_KEY', '');
    const privateKey = config.get<string>('VAPID_PRIVATE_KEY', '');
    this.enabled = Boolean(this.publicKey && privateKey);
    if (this.enabled) {
      webPush.setVapidDetails(
        config.get<string>('VAPID_SUBJECT', 'mailto:contact@cmciea-france.com'),
        this.publicKey,
        privateKey,
      );
    }
  }

  getConfiguration() {
    return { enabled: this.enabled, publicKey: this.enabled ? this.publicKey : null };
  }

  async subscribe(memberId: string, subscription: any) {
    if (!this.enabled) throw new ServiceUnavailableException('Notifications push non configurées.');
    const endpoint = subscription?.endpoint;
    const p256dh = subscription?.keys?.p256dh;
    const auth = subscription?.keys?.auth;
    if (!endpoint || !p256dh || !auth) {
      throw new ServiceUnavailableException('Abonnement push invalide.');
    }
    const existing = await this.repo.findOne({ where: { endpoint } });
    await this.repo.save(existing
      ? Object.assign(existing, { memberId, p256dh, auth })
      : this.repo.create({ memberId, endpoint, p256dh, auth }));
    return { subscribed: true };
  }

  async unsubscribe(memberId: string, endpoint: string) {
    await this.repo.delete({ memberId, endpoint });
    return { subscribed: false };
  }

  async sendMeetingReminder(meeting: { id: string; title: string; startTime: Date }) {
    if (!this.enabled) return 0;
    const subscriptions = await this.repo.find();
    const payload = JSON.stringify({
      notification: {
        title: 'Réunion CMCIEA dans 1 heure',
        body: meeting.title,
        icon: '/assets/icons/icon-192x192.png',
        badge: '/assets/icons/icon-72x72.png',
        data: { url: '/reunions', meetingId: meeting.id },
        actions: [{ action: 'open', title: 'Voir la réunion' }],
      },
    });
    let sent = 0;
    for (const subscription of subscriptions) {
      try {
        await webPush.sendNotification({
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        }, payload);
        sent++;
      } catch (error: any) {
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          await this.repo.delete(subscription.id);
        } else {
          this.logger.warn(`Notification push échouée: ${error?.message ?? error}`);
        }
      }
    }
    return sent;
  }
}
