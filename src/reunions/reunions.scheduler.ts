import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Meeting } from '../database/entities/meeting.entity';
import { Member } from '../database/entities/member.entity';
import { MailService } from '../mail/mail.service';

@Injectable()
export class ReunionsScheduler {
  private readonly logger = new Logger(ReunionsScheduler.name);

  constructor(
    @InjectRepository(Meeting) private meetingRepo: Repository<Meeting>,
    @InjectRepository(Member) private memberRepo: Repository<Member>,
    private mailService: MailService,
  ) {}

  // Vérifie toutes les 15 min s'il y a des réunions qui commencent dans ~1h
  @Cron('*/15 * * * *')
  async sendUpcomingMeetingReminders() {
    const now = new Date();
    const in55min = new Date(now.getTime() + 55 * 60 * 1000);
    const in65min = new Date(now.getTime() + 65 * 60 * 1000);

    const meetings = await this.meetingRepo.find({
      where: {
        status: 'scheduled',
        startTime: Between(in55min, in65min),
      },
    });

    if (meetings.length === 0) return;

    const members = await this.memberRepo.find({ where: { isActive: true } });

    for (const meeting of meetings) {
      let sent = 0;
      for (const member of members) {
        if (!member.email) continue;
        await this.mailService.sendMeetingReminder(
          member.email,
          member.firstName,
          { title: meeting.title, startTime: meeting.startTime },
        );
        sent++;
      }
      this.logger.log(`Rappels envoyés pour "${meeting.title}" : ${sent} membres`);
    }
  }
}
