import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Meeting } from '../database/entities/meeting.entity';
import { Member } from '../database/entities/member.entity';
import { MailService } from '../mail/mail.service';
import { ReunionsService } from './reunions.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ReunionsScheduler {
  private readonly logger = new Logger(ReunionsScheduler.name);
  private twilioClient: any;

  constructor(
    @InjectRepository(Meeting) private meetingRepo: Repository<Meeting>,
    @InjectRepository(Member) private memberRepo: Repository<Member>,
    private mailService: MailService,
    private config: ConfigService,
    private reunionsService: ReunionsService,
    private notifications: NotificationsService,
  ) {
    const sid = config.get('TWILIO_ACCOUNT_SID');
    const token = config.get('TWILIO_AUTH_TOKEN');
    if (sid && token) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const twilio = require('twilio');
      this.twilioClient = twilio(sid, token);
    }
  }

  @Cron('0 */6 * * *')
  async generateRecurringMeetings() {
    await this.reunionsService.generateRecurringOccurrences();
  }

  @Cron('*/15 * * * *')
  async sendUpcomingMeetingReminders() {
    const now = new Date();
    const emailMeetings = await this.findMeetingsInWindow(now, 55, 65);
    const smsMeetings = await this.findMeetingsInWindow(now, 25, 35);
    if (emailMeetings.length === 0 && smsMeetings.length === 0) return;
    const members = await this.memberRepo.find({ where: { isActive: true } });

    for (const meeting of emailMeetings) {
      let sent = 0;
      for (const member of members) {
        if (member.email) {
          await this.mailService.sendMeetingReminder(
            member.email,
            member.firstName,
            { title: meeting.title, startTime: meeting.startTime },
          );
          sent++;
        }
      }
      const pushSent = await this.notifications.sendMeetingReminder(meeting);
      this.logger.log(`Rappel H-1 pour "${meeting.title}": ${sent} emails, ${pushSent} push`);
    }

    for (const meeting of smsMeetings) {
      let sent = 0;
      const startStr = new Intl.DateTimeFormat('fr-FR', {
        hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris',
      }).format(new Date(meeting.startTime));
      for (const member of members) {
        if (member.phone && this.twilioClient) {
          try {
            await this.twilioClient.messages.create({
              body: `CMCIEA France - Rappel : "${meeting.title}" commence à ${startStr}. Rejoignez sur cmciea-france.com/reunions`,
              from: this.config.get('TWILIO_PHONE_NUMBER'),
              to: member.phone,
            });
            sent++;
          } catch (e) {
            this.logger.warn(`SMS échec pour ${member.phone}: ${e.message}`);
          }
        }
      }
      this.logger.log(`Rappel H-30 pour "${meeting.title}": ${sent} SMS`);
    }
  }

  private findMeetingsInWindow(now: Date, fromMinutes: number, toMinutes: number) {
    return this.meetingRepo.find({
      where: {
        status: 'scheduled',
        startTime: Between(
          new Date(now.getTime() + fromMinutes * 60 * 1000),
          new Date(now.getTime() + toMinutes * 60 * 1000),
        ),
      },
    });
  }
}
