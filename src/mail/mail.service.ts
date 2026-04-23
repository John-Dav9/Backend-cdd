import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { CreateInscriptionDto, InscriptionType } from '../inscriptions/dto/create-inscription.dto';

@Injectable()
export class MailService {
  private resend: Resend | null = null;
  private readonly logger = new Logger(MailService.name);

  constructor(private config: ConfigService) {
    const resendApiKey = this.config.get<string>('RESEND_API_KEY');

    if (!resendApiKey) {
      this.logger.warn(
        'RESEND_API_KEY is missing. Mail sending is disabled until this variable is configured.',
      );
      return;
    }

    this.resend = new Resend(resendApiKey);
  }

  private isMailConfigured(): boolean {
    if (!this.resend) {
      this.logger.warn('Email skipped: mail provider is not configured.');
      return false;
    }

    return true;
  }

  private get from(): string {
    return this.config.get('MAIL_FROM');
  }

  private get admin(): string {
    return this.config.get('MAIL_ADMIN');
  }

  async sendConfirmationInscription(dto: CreateInscriptionDto) {
    if (!this.isMailConfigured()) return;

    const labels: Record<InscriptionType, string> = {
      [InscriptionType.MARATHON]: 'Marathon Biblique',
      [InscriptionType.CULTE]: 'Venir au culte',
      [InscriptionType.LECTURE_BIBLIQUE]: 'Lecture biblique (Telegram)',
    };

    const label = labels[dto.type];

    let details = '';
    if (dto.type === InscriptionType.CULTE && dto.dateCulte) {
      details = `<p><strong>Date souhaitée :</strong> ${dto.dateCulte}</p>`;
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
        <p>Votre inscription à <strong>${label}</strong> a bien été enregistrée.</p>
        ${details}
        <p>Nous reviendrons vers vous très prochainement.</p>
        <br/>
        <p>Bénédictions,<br/>L'équipe CMCIEA France</p>
      `,
    }).catch((err) => this.logger.error('Resend error', err));
  }

  async sendContact(nom: string, email: string, message: string) {
    if (!this.isMailConfigured()) return;

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

  // ─── Marathon emails ───────────────────────────────────────────────────────

  async sendBienvenueMarathon(to: string, fullName: string, marathon: any) {
    if (!this.isMailConfigured()) return;

    const prenom = fullName.split(' ')[0];
    await this.resend!.emails.send({
      from: this.from,
      to,
      subject: `Bienvenue dans le Marathon \u2013 ${marathon.titre}`,
      html: `
        <h2>Bienvenue ${prenom} !</h2>
        <p>Tu es inscrit(e) au <strong>${marathon.titre}</strong>.</p>
        <p>
          <strong>Du ${marathon.dateDebut} au ${marathon.dateFin}</strong><br/>
          ${marathon.nbJours} jours de lecture &mdash; ${marathon.description ?? ''}
        </p>
        <h3>Comment participer ?</h3>
        <ol>
          <li>Lis chaque jour la portion assign&eacute;e dans ton plan de lecture.</li>
          <li>Coche chaque journ&eacute;e lue sur le site pour suivre ta progression.</li>
          <li>Ta progression est visible en temps r&eacute;el et tu verras ton classement parmi les participants.</li>
        </ol>
        <p>Quand tu atteins 25%, 50%, 75% et 100% de la lecture, tu recevras un email personnalis&eacute;.</p>
        <p>Lorsque tu termines le marathon, une <strong>attestation de participation</strong> te sera envoy&eacute;e automatiquement.</p>
        <br/>
        <p>Que Dieu b&eacute;nisse ta lecture !<br/>L&rsquo;&eacute;quipe CMCIEA France</p>
      `,
    }).catch(err => this.logger.error('Mail bienvenue marathon', err));
  }

  async sendEncouragementMarathon(to: string, fullName: string, marathon: any, percent: number) {
    if (!this.isMailConfigured()) return;

    const prenom = fullName.split(' ')[0];
    const messages: Record<number, string> = {
      25: 'Tu as parcouru 25% du chemin. Continue, tu es sur la bonne voie !',
      50: 'La moiti&eacute; est faite ! Tu avances tr&egrave;s bien.',
      75: 'Plus que 25% ! Tu es presque au bout, ne l&apos;arr&ecirc;te pas maintenant !',
    };

    await this.resend!.emails.send({
      from: this.from,
      to,
      subject: `${percent}% accompli \u2013 ${marathon.titre}`,
      html: `
        <h2>Bravo ${prenom} !</h2>
        <p>Tu as atteint <strong>${percent}%</strong> de ton Marathon Biblique <em>${marathon.titre}</em>.</p>
        <p>${messages[percent] ?? ''}</p>
        <br/>
        <p>Bonne continuation !<br/>L&rsquo;&eacute;quipe CMCIEA France</p>
      `,
    }).catch(err => this.logger.error('Mail encouragement marathon', err));
  }

  async sendAttestationMarathon(to: string, fullName: string, marathon: any) {
    if (!this.isMailConfigured()) return;

    const prenom = fullName.split(' ')[0];
    await this.resend!.emails.send({
      from: this.from,
      to,
      subject: `F&eacute;licitations \u2013 Marathon termin&eacute; ! ${marathon.titre}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:2px solid #c8a84b;padding:32px;border-radius:8px;">
          <h1 style="text-align:center;color:#c8a84b;">ATTESTATION DE PARTICIPATION</h1>
          <p style="text-align:center;">La CMCIEA-FRANCE certifie que</p>
          <h2 style="text-align:center;color:#222;">${fullName}</h2>
          <p style="text-align:center;">a complet&eacute; int&eacute;gralement le</p>
          <h3 style="text-align:center;">${marathon.titre}</h3>
          <p style="text-align:center;">Du ${marathon.dateDebut} au ${marathon.dateFin}</p>
          <hr style="border-color:#c8a84b;margin:24px 0;"/>
          <p style="text-align:center;">
            &laquo;&nbsp;Ta parole est une lampe &agrave; mes pieds, et une lumi&egrave;re sur mon sentier.&nbsp;&raquo;<br/>
            <em>Psaumes 119:105</em>
          </p>
          <br/>
          <p style="text-align:center;">F&eacute;licitations ${prenom} !<br/>L&rsquo;&eacute;quipe CMCIEA France</p>
        </div>
      `,
    }).catch(err => this.logger.error('Mail attestation marathon', err));
  }

  async sendAttestationAnnuelle(to: string, fullName: string, annee: number, nbMarathons: number) {
    if (!this.isMailConfigured()) return;

    const prenom = fullName.split(' ')[0];
    await this.resend!.emails.send({
      from: this.from,
      to,
      subject: `Attestation de fid&eacute;lit&eacute; ${annee} \u2013 CMCIEA France`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:2px solid #2c5f8a;padding:32px;border-radius:8px;">
          <h1 style="text-align:center;color:#2c5f8a;">ATTESTATION DE FIDELIT&Eacute; ${annee}</h1>
          <p style="text-align:center;">La CMCIEA-FRANCE certifie que</p>
          <h2 style="text-align:center;color:#222;">${fullName}</h2>
          <p style="text-align:center;">
            a particip&eacute; fid&egrave;lement aux <strong>${nbMarathons} marathon(s) biblique(s)</strong><br/>
            organis&eacute;s au cours de l&rsquo;ann&eacute;e <strong>${annee}</strong>
          </p>
          <hr style="border-color:#2c5f8a;margin:24px 0;"/>
          <p style="text-align:center;">
            &laquo;&nbsp;Heureux l&rsquo;homme qui ne marche pas selon le conseil des m&eacute;chants&hellip;<br/>
            mais qui trouve son plaisir dans la loi de l&rsquo;&Eacute;ternel.&nbsp;&raquo;<br/>
            <em>Psaumes 1:1-2</em>
          </p>
          <br/>
          <p style="text-align:center;">Merci pour ta fid&eacute;lit&eacute;, ${prenom} !<br/>L&rsquo;&eacute;quipe CMCIEA France</p>
        </div>
      `,
    }).catch(err => this.logger.error('Mail attestation annuelle', err));
  }

  async sendAnnonce(destinataires: string[], sujet: string, contenu: string) {
    if (!this.isMailConfigured()) return;

    for (const to of destinataires) {
      await this.resend!.emails.send({
        from: this.from,
        to,
        subject: sujet,
        html: `
          <div>${contenu}</div>
          <br/>
          <p style="color:#999;font-size:12px;">
            CMCIEA France — <a href="https://cmciea-france.com">cmciea-france.com</a>
          </p>
        `,
      }).catch((err) => this.logger.error('Resend error', err));
    }
  }
}
