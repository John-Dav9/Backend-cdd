import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Meeting } from '../database/entities/meeting.entity';
import { Member } from '../database/entities/member.entity';
import { MailService } from '../mail/mail.service';

@Injectable()
export class ReunionsScheduler {
  private readonly logger = new Logger(ReunionsScheduler.name);
  private twilioClient: any;

  constructor(
    @InjectRepository(Meeting) private meetingRepo: Repository<Meeting>,
    @InjectRepository(Member) private memberRepo: Repository<Member>,
    private mailService: MailService,
    private config: ConfigService,
  ) {
    const sid = config.get('TWILIO_ACCOUNT_SID');
    const token = config.get('TWILIO_AUTH_TOKEN');
    if (sid && token) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const twilio = require('twilio');
      this.twilioClient = twilio(sid, token);
    }
  }

  @Cron('*/15 * * * *')
  async sendUpcomingMeetingReminders() {
    const now = new Date();
    const in55min = new Date(now.getTime() + 55 * 60 * 1000);
    const in65min = new Date(now.getTime() + 65 * 60 * 1000);

    const meetings = await this.meetingRepo.find({
      where: { status: 'scheduled', startTime: Between(in55min, in65min) },
    });

    if (meetings.length === 0) return;

    const members = await this.memberRepo.find({ where: { isActive: true } });

    for (const meeting of meetings) {
      let emailSent = 0;
      let smsSent = 0;
      const startStr = new Intl.DateTimeFormat('fr-FR', {
        hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris',
      }).format(new Date(meeting.startTime));

      for (const member of members) {
        // Email
        if (member.email) {
          await this.mailService.sendMeetingReminder(
            member.email,
            member.firstName,
            { title: meeting.title, startTime: meeting.startTime },
          );
          emailSent++;
        }
        // SMS (membres avec téléphone uniquement)
        if (member.phone && this.twilioClient) {
          try {
            await this.twilioClient.messages.create({
              body: `CMCIEA France - Rappel : "${meeting.title}" commence à ${startStr}. Rejoignez sur cmciea-france.com/reunions`,
              from: this.config.get('TWILIO_PHONE_NUMBER'),
              to: member.phone,
            });
            smsSent++;
          } catch (e) {
            this.logger.warn(`SMS échec pour ${member.phone}: ${e.message}`);
          }
        }
      }
      this.logger.log(`Rappels pour "${meeting.title}": ${emailSent} emails, ${smsSent} SMS`);
    }
  }
}
