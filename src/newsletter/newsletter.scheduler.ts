import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { Actualite } from '../database/entities/actualite.entity';
import { Meeting } from '../database/entities/meeting.entity';
import { MailService } from '../mail/mail.service';
import { NewsletterService } from './newsletter.service';

@Injectable()
export class NewsletterScheduler {
  private readonly logger = new Logger(NewsletterScheduler.name);

  constructor(
    private newsletterService: NewsletterService,
    private mailService: MailService,
    @InjectRepository(Actualite) private actualiteRepo: Repository<Actualite>,
    @InjectRepository(Meeting) private meetingRepo: Repository<Meeting>,
  ) {}

  // Chaque lundi à 9h00
  @Cron('0 9 * * 1')
  async sendWeeklyDigest() {
    const emails = await this.newsletterService.getEmails();
    if (emails.length === 0) return;

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const [recentActualites, upcomingMeetings] = await Promise.all([
      this.actualiteRepo.find({
        where: { publiee: true, createdAt: MoreThanOrEqual(weekAgo) },
        order: { createdAt: 'DESC' },
        take: 3,
      }),
      this.meetingRepo.find({
        where: { status: 'scheduled' },
        order: { startTime: 'ASC' },
        take: 3,
      }),
    ]);

    const actualitesHtml = recentActualites.length
      ? recentActualites.map(a => `
        <div style="border-left:4px solid #1D546C;padding:8px 16px;margin:8px 0;">
          <strong style="color:#1A3D64;">${a.titre}</strong>
          <p style="color:#555;font-size:13px;margin:4px 0;">${(a.contenu ?? '').substring(0, 120)}${(a.contenu?.length ?? 0) > 120 ? '…' : ''}</p>
        </div>`).join('')
      : '<p style="color:#9ca3af;font-style:italic;">Aucune nouvelle cette semaine.</p>';

    const reunionsHtml = upcomingMeetings.length
      ? upcomingMeetings.map(m => {
          const d = new Date(m.startTime).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
          return `<li style="padding:4px 0;color:#374151;">${d} — <strong>${m.title}</strong></li>`;
        }).join('')
      : '<li style="color:#9ca3af;font-style:italic;">Aucune réunion programmée.</li>';

    const body = `
      <h2 style="margin:0 0 8px;color:#1A3D64;font-size:22px;">Bonjour &agrave; tous !</h2>
      <p style="color:#555;font-size:15px;line-height:1.6;margin:0 0 24px;">
        Voici le r&eacute;sum&eacute; de la semaine de votre communaut&eacute; CMCIEA France.
      </p>

      <h3 style="color:#1D546C;font-size:16px;margin:0 0 12px;">📰 Actualités de la semaine</h3>
      ${actualitesHtml}

      <h3 style="color:#1D546C;font-size:16px;margin:24px 0 12px;">📅 Prochaines réunions</h3>
      <ul style="padding-left:20px;margin:0 0 24px;">
        ${reunionsHtml}
      </ul>

      <p style="text-align:center;margin:0 0 24px;">
        <a href="https://cmciea-france.com/reunions"
           style="display:inline-block;background:linear-gradient(135deg,#1D546C,#1A3D64);color:#ffffff;
                  text-decoration:none;padding:14px 32px;border-radius:6px;font-size:15px;font-weight:bold;">
          Rejoindre les r&eacute;unions &rarr;
        </a>
      </p>
      <p style="margin:0;font-size:14px;color:#666;text-align:center;line-height:1.6;">
        Que le Seigneur vous b&eacute;nisse !<br/>
        <strong style="color:#1A3D64;">L'&eacute;quipe CMCIEA France</strong>
      </p>
    `;

    let sent = 0;
    for (const email of emails) {
      await this.mailService.sendAnnonce([email], 'Récap hebdomadaire CMCIEA France 📖', body).catch(() => {});
      sent++;
    }

    this.logger.log(`Newsletter hebdomadaire envoyée à ${sent} abonnés`);
  }
}
