import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { CreateInscriptionDto, InscriptionType } from '../inscriptions/dto/create-inscription.dto';

@Injectable()
export class MailService {
  private resend: Resend | null = null;
  private readonly logger = new Logger(MailService.name);
  private readonly fromAddress: string | null;
  private readonly adminAddress: string | null;

  constructor(private config: ConfigService) {
    const resendApiKey = this.config.get<string>('RESEND_API_KEY');
    this.fromAddress = this.config.get<string>('MAIL_FROM')?.trim() || null;
    this.adminAddress = this.config.get<string>('MAIL_ADMIN')?.trim() || null;

    if (!resendApiKey) {
      this.logger.warn(
        'RESEND_API_KEY is missing. Mail sending is disabled until this variable is configured.',
      );
      return;
    }

    this.resend = new Resend(resendApiKey);
  }

  get isConfigured(): boolean {
    return !!this.resend && !!this.fromAddress;
  }

  get isAdminInboxConfigured(): boolean {
    return this.isConfigured && !!this.adminAddress;
  }

  private canSendMail(requireAdminInbox = false): boolean {
    if (!this.resend) {
      this.logger.warn('Email skipped: mail provider is not configured.');
      return false;
    }

    if (!this.fromAddress) {
      this.logger.warn('Email skipped: MAIL_FROM is missing.');
      return false;
    }

    if (requireAdminInbox && !this.adminAddress) {
      this.logger.warn('Email skipped: MAIL_ADMIN is missing.');
      return false;
    }

    return true;
  }

  private get from(): string {
    return this.fromAddress!;
  }

  private get admin(): string {
    return this.adminAddress!;
  }

  async sendConfirmationInscription(dto: CreateInscriptionDto) {
    if (!this.canSendMail()) return;

    const labels: Record<InscriptionType, string> = {
      [InscriptionType.MARATHON]: 'Marathon Biblique',
      [InscriptionType.CULTE]: 'Venir au culte',
      [InscriptionType.LECTURE_BIBLIQUE]: 'Lecture biblique (Telegram)',
    };

    const label = labels[dto.type];

    let details = '';
    if (dto.type === InscriptionType.CULTE && dto.dateCulte) {
      details = `<p><strong>Date souhait&eacute;e :</strong> ${dto.dateCulte}</p>`;
    }
    if (dto.type === InscriptionType.LECTURE_BIBLIQUE && dto.pseudoTelegram) {
      details = `<p><strong>Pseudo Telegram :</strong> ${dto.pseudoTelegram}</p>`;
    }

    await this.resend!.emails.send({
      from: this.from,
      to: dto.email,
      subject: `Confirmation d'inscription – ${label}`,
      html: `
        <h2>Bonjour ${dto.prenom} ${dto.nom},</h2>
        <p>Votre inscription &agrave; <strong>${label}</strong> a bien &eacute;t&eacute; enregistr&eacute;e.</p>
        ${details}
        <p>Nous reviendrons vers vous tr&egrave;s prochainement.</p>
        <br/>
        <p>B&eacute;n&eacute;dictions,<br/>L&rsquo;&eacute;quipe CMCIEA France</p>
      `,
    }).catch((err) => this.logger.error('Resend error', err));
  }

  async sendContact(nom: string, email: string, message: string) {
    if (!this.canSendMail(true)) return;

    await this.resend!.emails.send({
      from: this.from,
      to: this.admin,
      subject: `Nouveau message de ${nom}`,
      html: `
        <h3>Message de contact</h3>
        <p><strong>Nom :</strong> ${nom}</p>
        <p><strong>Email :</strong> ${email}</p>
        <p><strong>Message :</strong></p>
        <p>${message.replace(/\n/g, '<br/>')}</p>
      `,
      reply_to: email,
    }).catch((err) => this.logger.error('Resend error', err));
  }

  // ─── Shared email shell ────────────────────────────────────────────────────

  private emailShell(content: string): string {
    const logo = 'https://cmciea-france.com/assets/images/logo-cmciea-france.png';
    const site = 'https://cmciea-france.com';
    const dashboard = 'https://cmciea-france.com/mon-espace';
    return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

      <!-- Header -->
      <tr>
        <td style="background:linear-gradient(135deg,#1D546C 0%,#1A3D64 100%);padding:28px 32px;text-align:center;">
          <img src="${logo}" alt="CMCIEA France" height="56" style="display:block;margin:0 auto 12px;max-height:56px;"/>
          <p style="margin:0;color:#a8d8e8;font-size:13px;letter-spacing:1px;text-transform:uppercase;">Marathon Biblique</p>
        </td>
      </tr>

      <!-- Body -->
      <tr><td style="padding:36px 40px;">
        ${content}
      </td></tr>

      <!-- Footer -->
      <tr>
        <td style="background:#f8f8f8;border-top:1px solid #e8e8e8;padding:20px 40px;text-align:center;">
          <p style="margin:0 0 8px;font-size:13px;color:#666;">
            <a href="${dashboard}" style="color:#1D546C;font-weight:bold;text-decoration:none;">Mon espace participant</a>
            &nbsp;&bull;&nbsp;
            <a href="${site}" style="color:#1D546C;text-decoration:none;">cmciea-france.com</a>
          </p>
          <p style="margin:0;font-size:11px;color:#999;">CMCIEA France &mdash; &Eacute;glise Chr&eacute;tienne</p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body></html>`;
  }

  // ─── Marathon emails ───────────────────────────────────────────────────────

  async sendBienvenueMarathon(to: string, fullName: string, marathon: any) {
    if (!this.canSendMail()) return;

    const prenom = fullName.split(' ')[0];
    const dashboard = 'https://cmciea-france.com/mon-espace';

    const body = `
      <h2 style="margin:0 0 8px;color:#1A3D64;font-size:22px;">Bienvenue ${prenom}&nbsp;! 🎉</h2>
      <p style="margin:0 0 20px;color:#555;font-size:15px;line-height:1.6;">
        Nous sommes ravis de t&rsquo;accueillir dans le <strong style="color:#1D546C;">${marathon.titre}</strong>.<br/>
        Ce marathon est bien plus qu&rsquo;une lecture&nbsp;: c&rsquo;est un rendez-vous quotidien avec la Parole de Dieu.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#EEF6FA;border-left:4px solid #00B7B5;border-radius:6px;margin:0 0 24px;">
        <tr><td style="padding:16px 20px;">
          <p style="margin:0 0 6px;font-size:14px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">D&eacute;tails du marathon</p>
          <p style="margin:0;font-size:15px;color:#1A3D64;"><strong>&#128197; ${marathon.dateDebut} &rarr; ${marathon.dateFin}</strong></p>
          <p style="margin:4px 0 0;font-size:14px;color:#555;">${marathon.nbJours} jours de lecture &mdash; ${marathon.description ?? ''}</p>
        </td></tr>
      </table>

      <h3 style="margin:0 0 12px;color:#1A3D64;font-size:16px;">Comment participer ?</h3>
      <ol style="margin:0 0 24px;padding-left:20px;color:#444;font-size:14px;line-height:2;">
        <li>Lis chaque jour la portion assign&eacute;e dans ton plan de lecture.</li>
        <li>Coche chaque journ&eacute;e sur le site pour enregistrer ta progression.</li>
        <li>Suis ton classement en temps r&eacute;el parmi tous les participants.</li>
        <li>&Agrave; 25%, 50%, 75% et 100%, tu recevras un email d&rsquo;encouragement personnalis&eacute;.</li>
        <li>En finissant le marathon, une <strong>attestation officielle</strong> t&rsquo;est envoy&eacute;e automatiquement.</li>
      </ol>

      <div style="background:#FFF8E7;border:1px solid #f0d080;border-radius:8px;padding:16px 20px;margin:0 0 28px;text-align:center;">
        <p style="margin:0 0 6px;font-size:13px;color:#999;font-style:italic;">Un verset pour ton marathon</p>
        <p style="margin:0;font-size:15px;color:#444;line-height:1.6;">
          &laquo;&nbsp;Tout ce qui est &eacute;crit d&rsquo;avance a &eacute;t&eacute; &eacute;crit pour notre instruction,
          afin que, par la patience et par la consolation que donnent les &Eacute;critures,
          nous poss&eacute;dions l&rsquo;esp&eacute;rance.&nbsp;&raquo;
        </p>
        <p style="margin:8px 0 0;font-size:13px;color:#888;"><em>Romains 15:4</em></p>
      </div>

      <p style="text-align:center;margin:0 0 24px;">
        <a href="${dashboard}" style="display:inline-block;background:linear-gradient(135deg,#1D546C,#1A3D64);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:15px;font-weight:bold;">
          Acc&eacute;der &agrave; mon espace &rarr;
        </a>
      </p>

      <p style="margin:0;font-size:14px;color:#666;line-height:1.6;">
        Que Dieu b&eacute;nisse ta lecture et que Sa Parole illumine chaque journ&eacute;e de ce marathon&nbsp;!<br/><br/>
        Avec affection,<br/>
        <strong style="color:#1A3D64;">L&rsquo;&eacute;quipe CMCIEA France</strong>
      </p>
    `;

    await this.resend!.emails.send({
      from: this.from,
      to,
      subject: `Bienvenue dans le Marathon – ${marathon.titre} 📖`,
      html: this.emailShell(body),
    }).catch(err => this.logger.error('Mail bienvenue marathon', err));
  }

  async sendEncouragementMarathon(to: string, fullName: string, marathon: any, percent: number) {
    if (!this.canSendMail()) return;

    const prenom = fullName.split(' ')[0];
    const dashboard = 'https://cmciea-france.com/mon-espace';

    type LevelData = { emoji: string; headline: string; message: string; verse: string; reference: string };
    const data: Record<number, LevelData> = {
      25: {
        emoji: '🌱',
        headline: `${prenom}, tu as fait tes premiers pas&nbsp;!`,
        message: `Tu as parcouru <strong>25%</strong> du <em>${marathon.titre}</em>. Tu as pos&eacute; les fondations d&rsquo;une discipline spirituelle solide. Chaque jour coch&eacute; est une victoire. Continue &agrave; ce rythme, la Parole de Dieu est en train de s&rsquo;ancrer dans ton c&oelig;ur.`,
        verse: '&laquo;&nbsp;Heureux ceux qui ont faim et soif de la justice, car ils seront rassasi&eacute;s.&nbsp;&raquo;',
        reference: 'Matthieu 5:6',
      },
      50: {
        emoji: '🔥',
        headline: `${prenom}, tu es &agrave; mi-chemin &mdash; impressionnant&nbsp;!`,
        message: `La moiti&eacute; du <em>${marathon.titre}</em> est derri&egrave;re toi. <strong>50%</strong> accomplis&nbsp;! Ce n&rsquo;est pas anodin. Nombreux abandonnent, toi tu continues. Ta pers&eacute;v&eacute;rance honore Dieu et t&rsquo;enrichit chaque jour. L&rsquo;autre moiti&eacute; t&rsquo;attend avec encore plus de tr&eacute;sors.`,
        verse: '&laquo;&nbsp;Ne nous lassons pas de faire le bien&nbsp;; car nous moissonnerons au temps convenable, si nous ne nous rel&acirc;chons pas.&nbsp;&raquo;',
        reference: 'Galates 6:9',
      },
      75: {
        emoji: '⚡',
        headline: `${prenom}, la ligne d&rsquo;arriv&eacute;e est en vue&nbsp;!`,
        message: `<strong>75%</strong> du <em>${marathon.titre}</em> accomplis &mdash; tu es dans le dernier quart&nbsp;! Ce moment est souvent le plus d&eacute;licat, mais aussi le plus glorieux. Ne rel&acirc;che pas maintenant. L&rsquo;attestation et la joie d&rsquo;avoir tout lu t&rsquo;attendent de l&rsquo;autre c&ocirc;t&eacute;. Tiens bon&nbsp;!`,
        verse: '&laquo;&nbsp;J&rsquo;ai combattu le bon combat, j&rsquo;ai achev&eacute; la course, j&rsquo;ai gard&eacute; la foi.&nbsp;&raquo;',
        reference: '2 Timoth&eacute;e 4:7',
      },
    };

    const d = data[percent];
    if (!d) return;

    const body = `
      <p style="font-size:40px;margin:0 0 8px;text-align:center;">${d.emoji}</p>
      <h2 style="margin:0 0 8px;color:#1A3D64;font-size:22px;text-align:center;">${d.headline}</h2>

      <div style="background:#EEF6FA;border-radius:8px;padding:16px 20px;margin:20px 0 24px;text-align:center;">
        <p style="margin:0;font-size:32px;font-weight:bold;color:#1D546C;">${percent}%</p>
        <p style="margin:4px 0 0;font-size:13px;color:#888;">de progression accomplie</p>
      </div>

      <p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.7;text-align:center;">${d.message}</p>

      <div style="background:#FFF8E7;border:1px solid #f0d080;border-radius:8px;padding:16px 20px;margin:0 0 28px;text-align:center;">
        <p style="margin:0 0 6px;font-size:13px;color:#999;font-style:italic;">Un verset pour t&rsquo;encourager</p>
        <p style="margin:0;font-size:15px;color:#444;line-height:1.6;">${d.verse}</p>
        <p style="margin:8px 0 0;font-size:13px;color:#888;"><em>${d.reference}</em></p>
      </div>

      <p style="text-align:center;margin:0 0 24px;">
        <a href="${dashboard}" style="display:inline-block;background:linear-gradient(135deg,#1D546C,#1A3D64);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:15px;font-weight:bold;">
          Voir ma progression &rarr;
        </a>
      </p>

      <p style="margin:0;font-size:14px;color:#666;text-align:center;">
        Avec foi en toi,<br/>
        <strong style="color:#1A3D64;">L&rsquo;&eacute;quipe CMCIEA France</strong>
      </p>
    `;

    await this.resend!.emails.send({
      from: this.from,
      to,
      subject: `${d.emoji} ${percent}% accompli – ${marathon.titre}`,
      html: this.emailShell(body),
    }).catch(err => this.logger.error('Mail encouragement marathon', err));
  }

  async sendAttestationMarathon(to: string, fullName: string, marathon: any) {
    if (!this.canSendMail()) return;

    const prenom = fullName.split(' ')[0];
    const dashboard = 'https://cmciea-france.com/mon-espace';

    const body = `
      <div style="text-align:center;margin-bottom:24px;">
        <p style="font-size:48px;margin:0 0 8px;">🏆</p>
        <h2 style="margin:0 0 4px;color:#1A3D64;font-size:24px;">${prenom}, tu as termin&eacute; le Marathon&nbsp;!</h2>
        <p style="margin:0;color:#888;font-size:14px;">F&eacute;licitations pour cette r&eacute;alisation extraordinaire</p>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #c8a84b;border-radius:10px;margin:0 0 28px;overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#fffbf0,#fff8e1);padding:28px;text-align:center;">
          <p style="margin:0 0 6px;font-size:11px;color:#a08840;text-transform:uppercase;letter-spacing:2px;">Attestation de Participation</p>
          <p style="margin:0 0 10px;font-size:13px;color:#888;">La CMCIEA-FRANCE certifie que</p>
          <h3 style="margin:0 0 10px;color:#1A3D64;font-size:22px;font-weight:bold;">${fullName}</h3>
          <p style="margin:0 0 4px;font-size:13px;color:#888;">a compl&eacute;t&eacute; int&eacute;gralement le</p>
          <p style="margin:0 0 10px;font-size:17px;font-weight:bold;color:#1D546C;">${marathon.titre}</p>
          <p style="margin:0;font-size:13px;color:#888;">Du <strong>${marathon.dateDebut}</strong> au <strong>${marathon.dateFin}</strong></p>
          <div style="margin:18px auto 0;width:60px;height:3px;background:linear-gradient(90deg,#c8a84b,#e8c860);border-radius:2px;"></div>
        </td></tr>
      </table>

      <div style="background:#FFF8E7;border:1px solid #f0d080;border-radius:8px;padding:16px 20px;margin:0 0 28px;text-align:center;">
        <p style="margin:0;font-size:15px;color:#444;line-height:1.7;">
          &laquo;&nbsp;Ta parole est une lampe &agrave; mes pieds, et une lumi&egrave;re sur mon sentier.&nbsp;&raquo;
        </p>
        <p style="margin:8px 0 0;font-size:13px;color:#888;"><em>Psaumes 119:105</em></p>
      </div>

      <p style="margin:0 0 20px;color:#555;font-size:15px;line-height:1.7;text-align:center;">
        Tu viens d&rsquo;accomplir quelque chose de remarquable. Chaque page lue, chaque jour coch&eacute; &eacute;tait un acte de foi et de discipline. Que cette Parole que tu as sem&eacute;e dans ton c&oelig;ur porte des fruits abondants dans ta vie&nbsp;!
      </p>

      <p style="text-align:center;margin:0 0 24px;">
        <a href="${dashboard}" style="display:inline-block;background:linear-gradient(135deg,#c8a84b,#e8c860);color:#1A3D64;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:15px;font-weight:bold;">
          Voir mon attestation en ligne &rarr;
        </a>
      </p>

      <p style="margin:0;font-size:14px;color:#666;text-align:center;line-height:1.6;">
        Avec toute notre admiration,<br/>
        <strong style="color:#1A3D64;">L&rsquo;&eacute;quipe CMCIEA France</strong>
      </p>
    `;

    await this.resend!.emails.send({
      from: this.from,
      to,
      subject: `🏆 Félicitations – Tu as terminé le ${marathon.titre} !`,
      html: this.emailShell(body),
    }).catch(err => this.logger.error('Mail attestation marathon', err));
  }

  async sendAttestationAnnuelle(to: string, fullName: string, annee: number, nbMarathons: number) {
    if (!this.canSendMail()) return;

    const prenom = fullName.split(' ')[0];
    const dashboard = 'https://cmciea-france.com/mon-espace';

    const body = `
      <div style="text-align:center;margin-bottom:24px;">
        <p style="font-size:48px;margin:0 0 8px;">🌟</p>
        <h2 style="margin:0 0 4px;color:#1A3D64;font-size:24px;">${prenom}, quelle ann&eacute;e de fid&eacute;lit&eacute;&nbsp;!</h2>
        <p style="margin:0;color:#888;font-size:14px;">Attestation de fid&eacute;lit&eacute; ${annee}</p>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #1D546C;border-radius:10px;margin:0 0 28px;overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#eef6fa,#e0f0f8);padding:28px;text-align:center;">
          <p style="margin:0 0 6px;font-size:11px;color:#1D546C;text-transform:uppercase;letter-spacing:2px;">Attestation de Fid&eacute;lit&eacute; ${annee}</p>
          <p style="margin:0 0 10px;font-size:13px;color:#888;">La CMCIEA-FRANCE certifie que</p>
          <h3 style="margin:0 0 10px;color:#1A3D64;font-size:22px;font-weight:bold;">${fullName}</h3>
          <p style="margin:0 0 4px;font-size:13px;color:#888;">a particip&eacute; fid&egrave;lement aux</p>
          <p style="margin:0 0 4px;font-size:28px;font-weight:bold;color:#1D546C;">${nbMarathons}</p>
          <p style="margin:0;font-size:14px;color:#555;">marathon(s) biblique(s) organis&eacute;(s) en <strong>${annee}</strong></p>
          <div style="margin:18px auto 0;width:60px;height:3px;background:linear-gradient(90deg,#1D546C,#00B7B5);border-radius:2px;"></div>
        </td></tr>
      </table>

      <div style="background:#FFF8E7;border:1px solid #f0d080;border-radius:8px;padding:16px 20px;margin:0 0 28px;text-align:center;">
        <p style="margin:0;font-size:15px;color:#444;line-height:1.7;">
          &laquo;&nbsp;Heureux l&rsquo;homme&hellip; qui trouve son plaisir dans la loi de l&rsquo;&Eacute;ternel,
          et qui la m&eacute;dite jour et nuit&nbsp;!&nbsp;&raquo;
        </p>
        <p style="margin:8px 0 0;font-size:13px;color:#888;"><em>Psaumes 1:1-2</em></p>
      </div>

      <p style="margin:0 0 20px;color:#555;font-size:15px;line-height:1.7;text-align:center;">
        Ta fid&eacute;lit&eacute; tout au long de cette ann&eacute;e est une inspiration pour toute la communaut&eacute;. Tu as d&eacute;montr&eacute; qu&rsquo;avec pers&eacute;v&eacute;rance, la Parole de Dieu peut &ecirc;tre au c&oelig;ur de chaque saison de la vie.
      </p>

      <p style="text-align:center;margin:0 0 24px;">
        <a href="${dashboard}" style="display:inline-block;background:linear-gradient(135deg,#1D546C,#1A3D64);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:15px;font-weight:bold;">
          Mon tableau de bord &rarr;
        </a>
      </p>

      <p style="margin:0;font-size:14px;color:#666;text-align:center;line-height:1.6;">
        Merci pour ta fid&eacute;lit&eacute; en ${annee}, ${prenom}&nbsp;!<br/>
        <strong style="color:#1A3D64;">L&rsquo;&eacute;quipe CMCIEA France</strong>
      </p>
    `;

    await this.resend!.emails.send({
      from: this.from,
      to,
      subject: `🌟 Attestation de fidélité ${annee} – CMCIEA France`,
      html: this.emailShell(body),
    }).catch(err => this.logger.error('Mail attestation annuelle', err));
  }

  async sendAnnonce(destinataires: string[], sujet: string, contenu: string) {
    if (!this.canSendMail()) return;

    for (const to of destinataires) {
      await this.resend!.emails.send({
        from: this.from,
        to,
        subject: sujet,
        html: `
          <div>${contenu}</div>
          <br/>
          <p style="color:#999;font-size:12px;">
            CMCIEA France &mdash; <a href="https://cmciea-france.com">cmciea-france.com</a>
          </p>
        `,
      }).catch((err) => this.logger.error('Resend error', err));
    }
  }
}
