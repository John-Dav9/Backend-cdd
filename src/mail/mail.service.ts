import * as https from 'https';
import * as http from 'http';
import PDFDocument = require('pdfkit');
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { CreateInscriptionDto, InscriptionType } from '../inscriptions/dto/create-inscription.dto';
import { FirebaseService } from '../firebase/firebase.service';

export interface EmailTemplate {
  key: string;
  label: string;
  description: string;
  variables: string[];
  subject: string;
  body: string;
  customized?: boolean;
  updatedAt?: string;
}

const TEMPLATE_COL = 'email_templates';

@Injectable()
export class MailService {
  private resend: Resend | null = null;
  private readonly logger = new Logger(MailService.name);
  private readonly fromAddress: string | null;
  private readonly adminAddress: string | null;

  constructor(
    private config: ConfigService,
    private firebase: FirebaseService,
  ) {
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

  private get from(): string { return this.fromAddress!; }
  private get admin(): string { return this.adminAddress!; }

  // ─── Fetch remote image → Buffer ──────────────────────────────────────────

  private fetchImage(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const get = url.startsWith('https') ? https.get : http.get;
      get(url, { timeout: 5000 }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      }).on('error', reject);
    });
  }

  // ─── PDF Certificate ──────────────────────────────────────────────────────

  async generateCertificatePdf(data: {
    fullName: string;
    marathonTitre: string;
    dateDebut: string;
    dateFin: string;
    rank: number | null;
    totalParticipants: number | null;
  }): Promise<Buffer> {
    let logoBuffer: Buffer | null = null;
    try {
      logoBuffer = await this.fetchImage(
        'https://cmciea-france.com/assets/images/logo-cmciea-france.png',
      );
    } catch { /* continue without logo */ }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 0, info: { Title: 'Attestation de participation', Author: 'CMCIEA France' } });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const W = doc.page.width;   // 595.28
      const H = doc.page.height;  // 841.89
      const ml = 50;              // left margin
      const mr = 50;              // right margin
      const cw = W - ml - mr;    // content width

      const darkBlue = '#1A3D64';
      const midBlue  = '#1D546C';
      const gold     = '#c8a84b';
      const goldLight = '#FFF8E7';
      const goldBorder = '#e8c860';

      // ── Header ─────────────────────────────────────────────────────────────
      doc.rect(0, 0, W, 115).fill(darkBlue);

      if (logoBuffer) {
        try { doc.image(logoBuffer, ml, 18, { height: 78 }); } catch { /* skip */ }
      }

      doc.fontSize(20).fillColor('#ffffff').font('Helvetica-Bold')
         .text('CMCIEA FRANCE', logoBuffer ? ml + 90 : ml, 32, { width: cw - (logoBuffer ? 90 : 0), align: logoBuffer ? 'right' : 'center' });
      doc.fontSize(9).fillColor('#a8d8e8').font('Helvetica')
         .text('Communauté Missionnaire Chrétienne Internationale et Églises Associées', logoBuffer ? ml + 90 : ml, 58, { width: cw - (logoBuffer ? 90 : 0), align: logoBuffer ? 'right' : 'center' });
      doc.fontSize(9).fillColor('#7ab8d0').font('Helvetica-Oblique')
         .text('"Chercheurs de Dieu"', logoBuffer ? ml + 90 : ml, 74, { width: cw - (logoBuffer ? 90 : 0), align: logoBuffer ? 'right' : 'center' });

      // ── Outer + inner gold border ───────────────────────────────────────────
      const fx = ml - 12, fy = 128, fw = cw + 24, fh = 640;
      doc.roundedRect(fx, fy, fw, fh, 6).stroke(gold).lineWidth(1.5);
      doc.roundedRect(fx + 4, fy + 4, fw - 8, fh - 8, 4).stroke(gold).lineWidth(0.4);

      // ── Certificate title ──────────────────────────────────────────────────
      doc.fontSize(8).fillColor(gold).font('Helvetica-Bold')
         .text('— ATTESTATION DE PARTICIPATION —', ml, 152, { width: cw, align: 'center', characterSpacing: 3 });

      // Gold ornament line
      const lineY = 170;
      doc.moveTo(ml + 60, lineY).lineTo(ml + cw - 60, lineY).stroke(gold).lineWidth(0.8);

      // Small gold diamond ornament
      const mid = ml + cw / 2;
      doc.polygon([mid - 4, lineY], [mid, lineY - 5], [mid + 4, lineY], [mid, lineY + 5]).fill(gold);

      // ── Certifies ──────────────────────────────────────────────────────────
      doc.fontSize(11).fillColor('#777777').font('Times-Italic')
         .text('La CMCIEA-FRANCE certifie que', ml, 186, { width: cw, align: 'center' });

      // ── Full name ──────────────────────────────────────────────────────────
      doc.fontSize(28).fillColor(darkBlue).font('Helvetica-Bold')
         .text(data.fullName, ml, 210, { width: cw, align: 'center' });

      // Name underline
      const nameY = 248;
      doc.moveTo(ml + 100, nameY).lineTo(ml + cw - 100, nameY).stroke(gold).lineWidth(0.5);

      // ── Completion phrase ──────────────────────────────────────────────────
      doc.fontSize(11).fillColor('#777777').font('Times-Italic')
         .text('a complété intégralement le', ml, 262, { width: cw, align: 'center' });

      // ── Marathon title ─────────────────────────────────────────────────────
      doc.fontSize(17).fillColor(midBlue).font('Helvetica-Bold')
         .text(data.marathonTitre, ml, 285, { width: cw, align: 'center' });

      // ── Dates ─────────────────────────────────────────────────────────────
      doc.fontSize(11).fillColor('#888888').font('Helvetica')
         .text(`Du ${data.dateDebut} au ${data.dateFin}`, ml, 316, { width: cw, align: 'center' });

      // ── Rank ──────────────────────────────────────────────────────────────
      let sepY = 345;
      if (data.rank && data.totalParticipants) {
        doc.roundedRect(ml + 100, 338, cw - 200, 26, 13)
           .fillAndStroke('#EEF6FA', '#b0d4e8');
        doc.fontSize(10).fillColor(darkBlue).font('Helvetica-Bold')
           .text(`Classement final : #${data.rank} sur ${data.totalParticipants} participants`, ml + 100, 344, { width: cw - 200, align: 'center' });
        sepY = 380;
      }

      // Gold separator
      doc.moveTo(ml + 40, sepY).lineTo(ml + cw - 40, sepY).stroke(gold).lineWidth(0.6);
      // Diamond ornament on separator
      doc.polygon([mid - 4, sepY], [mid, sepY - 5], [mid + 4, sepY], [mid, sepY + 5]).fill(gold);

      // ── Verse block ────────────────────────────────────────────────────────
      const vY = sepY + 18;
      doc.roundedRect(ml + 15, vY, cw - 30, 78, 5)
         .fillAndStroke(goldLight, goldBorder).lineWidth(0.8);

      doc.fontSize(10).fillColor('#555555').font('Times-Italic')
         .text('« Ta parole est une lampe à mes pieds,\net une lumière sur mon sentier. »', ml + 25, vY + 11, { width: cw - 50, align: 'center' });
      doc.fontSize(9).fillColor('#888888').font('Times-Roman')
         .text('— Psaumes 119:105', ml + 25, vY + 51, { width: cw - 50, align: 'center' });

      // ── Signature area ────────────────────────────────────────────────────
      const sigY = vY + 98;
      const today = new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });

      // Left column – date
      doc.fontSize(9).fillColor('#888888').font('Helvetica')
         .text('Délivrée le', ml + 20, sigY);
      doc.fontSize(10).fillColor(darkBlue).font('Helvetica-Bold')
         .text(today, ml + 20, sigY + 14);

      // Right column – signature
      const sigX = ml + cw - 170;
      doc.fontSize(9).fillColor('#888888').font('Helvetica')
         .text('Le Responsable', sigX, sigY, { width: 140, align: 'center' });
      doc.moveTo(sigX, sigY + 36).lineTo(sigX + 140, sigY + 36).stroke('#aaaaaa').lineWidth(0.6);
      doc.fontSize(9).fillColor('#888888').font('Helvetica')
         .text('CMCIEA France', sigX, sigY + 42, { width: 140, align: 'center' });

      // Bottom gold line
      const botY = fy + fh - 8;
      doc.moveTo(ml + 40, botY).lineTo(ml + cw - 40, botY).stroke(gold).lineWidth(0.5);

      // ── Footer ─────────────────────────────────────────────────────────────
      doc.rect(0, H - 52, W, 52).fill(darkBlue);
      doc.fontSize(8).fillColor('#a8d8e8').font('Helvetica')
         .text('cmciea-france.com  •  Marathon Biblique  •  CMCIEA France', 0, H - 35, { width: W, align: 'center' });

      doc.end();
    });
  }

  // ─── Shared email shell ────────────────────────────────────────────────────

  private emailShell(content: string): string {
    const logo      = 'https://cmciea-france.com/assets/images/logo-cmciea-france.png';
    const site      = 'https://cmciea-france.com';
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
      <tr><td style="padding:36px 40px;">${content}</td></tr>
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

  // ─── Email template system ────────────────────────────────────────────────

  private defaultTemplates(): Map<string, Omit<EmailTemplate, 'key' | 'customized' | 'updatedAt'>> {
    const dashboard = 'https://cmciea-france.com/mon-espace';
    return new Map([
      ['bienvenue_marathon', {
        label: 'Bienvenue Marathon',
        description: 'Envoyé quand un participant s\'inscrit à un marathon biblique.',
        variables: ['prenom', 'marathonTitre', 'dateDebut', 'dateFin', 'nbJours', 'description'],
        subject: 'Bienvenue dans le Marathon – {{marathonTitre}} 📖',
        body: `<h2 style="margin:0 0 8px;color:#1A3D64;font-size:22px;">Bienvenue {{prenom}}&nbsp;! 🎉</h2>
      <p style="margin:0 0 20px;color:#555;font-size:15px;line-height:1.6;">
        Nous sommes ravis de t&rsquo;accueillir dans le <strong style="color:#1D546C;">{{marathonTitre}}</strong>.<br/>
        Ce marathon est bien plus qu&rsquo;une lecture&nbsp;: c&rsquo;est un rendez-vous quotidien avec la Parole de Dieu.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#EEF6FA;border-left:4px solid #00B7B5;border-radius:6px;margin:0 0 24px;">
        <tr><td style="padding:16px 20px;">
          <p style="margin:0 0 6px;font-size:14px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">D&eacute;tails du marathon</p>
          <p style="margin:0;font-size:15px;color:#1A3D64;"><strong>&#128197; {{dateDebut}} &rarr; {{dateFin}}</strong></p>
          <p style="margin:4px 0 0;font-size:14px;color:#555;">{{nbJours}} jours de lecture &mdash; {{description}}</p>
        </td></tr>
      </table>
      <h3 style="margin:0 0 12px;color:#1A3D64;font-size:16px;">Comment participer ?</h3>
      <ol style="margin:0 0 24px;padding-left:20px;color:#444;font-size:14px;line-height:2;">
        <li>Lis chaque jour la portion assign&eacute;e dans ton plan de lecture.</li>
        <li>Coche chaque journ&eacute;e sur le site pour enregistrer ta progression.</li>
        <li>Suis ton classement en temps r&eacute;el parmi tous les participants.</li>
        <li>&Agrave; 25%, 50%, 75% et 100%, tu recevras un email d&rsquo;encouragement personnalis&eacute;.</li>
        <li>En finissant le marathon, une <strong>attestation officielle en PDF</strong> t&rsquo;est envoy&eacute;e automatiquement.</li>
      </ol>
      <div style="background:#FFF8E7;border:1px solid #f0d080;border-radius:8px;padding:16px 20px;margin:0 0 28px;text-align:center;">
        <p style="margin:0 0 6px;font-size:13px;color:#999;font-style:italic;">Un verset pour ton marathon</p>
        <p style="margin:0;font-size:15px;color:#444;line-height:1.6;">&laquo;&nbsp;Tout ce qui est &eacute;crit d&rsquo;avance a &eacute;t&eacute; &eacute;crit pour notre instruction, afin que, par la patience et par la consolation que donnent les &Eacute;critures, nous poss&eacute;dions l&rsquo;esp&eacute;rance.&nbsp;&raquo;</p>
        <p style="margin:8px 0 0;font-size:13px;color:#888;"><em>Romains 15:4</em></p>
      </div>
      <p style="text-align:center;margin:0 0 24px;">
        <a href="${dashboard}" style="display:inline-block;background:linear-gradient(135deg,#1D546C,#1A3D64);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:15px;font-weight:bold;">Acc&eacute;der &agrave; mon espace &rarr;</a>
      </p>
      <p style="margin:0;font-size:14px;color:#666;line-height:1.6;">Que Dieu b&eacute;nisse ta lecture&nbsp;!<br/><br/>Avec affection,<br/><strong style="color:#1A3D64;">L&rsquo;&eacute;quipe CMCIEA France</strong></p>`,
      }],
      ['encouragement_25', {
        label: 'Encouragement 25%',
        description: 'Envoyé quand le participant atteint 25% du marathon.',
        variables: ['prenom', 'marathonTitre', 'percent'],
        subject: '🌱 {{percent}}% accompli – {{marathonTitre}}',
        body: `<p style="font-size:40px;margin:0 0 8px;text-align:center;">🌱</p>
      <h2 style="margin:0 0 8px;color:#1A3D64;font-size:22px;text-align:center;">{{prenom}}, tu as fait tes premiers pas&nbsp;!</h2>
      <div style="background:#EEF6FA;border-radius:8px;padding:16px 20px;margin:20px 0 24px;text-align:center;">
        <p style="margin:0;font-size:32px;font-weight:bold;color:#1D546C;">{{percent}}%</p>
        <p style="margin:4px 0 0;font-size:13px;color:#888;">de progression accomplie</p>
      </div>
      <p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.7;text-align:center;">Tu as parcouru <strong>{{percent}}%</strong> du <em>{{marathonTitre}}</em>. Tu as pos&eacute; les fondations d&rsquo;une discipline spirituelle solide. Chaque jour coch&eacute; est une victoire.</p>
      <div style="background:#FFF8E7;border:1px solid #f0d080;border-radius:8px;padding:16px 20px;margin:0 0 28px;text-align:center;">
        <p style="margin:0 0 6px;font-size:13px;color:#999;font-style:italic;">Un verset pour t&rsquo;encourager</p>
        <p style="margin:0;font-size:15px;color:#444;line-height:1.6;">&laquo;&nbsp;Heureux ceux qui ont faim et soif de la justice, car ils seront rassasi&eacute;s.&nbsp;&raquo;</p>
        <p style="margin:8px 0 0;font-size:13px;color:#888;"><em>Matthieu 5:6</em></p>
      </div>
      <p style="text-align:center;margin:0 0 24px;">
        <a href="${dashboard}" style="display:inline-block;background:linear-gradient(135deg,#1D546C,#1A3D64);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:15px;font-weight:bold;">Voir ma progression &rarr;</a>
      </p>
      <p style="margin:0;font-size:14px;color:#666;text-align:center;">Avec foi en toi,<br/><strong style="color:#1A3D64;">L&rsquo;&eacute;quipe CMCIEA France</strong></p>`,
      }],
      ['encouragement_50', {
        label: 'Encouragement 50%',
        description: 'Envoyé quand le participant atteint 50% du marathon.',
        variables: ['prenom', 'marathonTitre', 'percent'],
        subject: '🔥 {{percent}}% accompli – {{marathonTitre}}',
        body: `<p style="font-size:40px;margin:0 0 8px;text-align:center;">🔥</p>
      <h2 style="margin:0 0 8px;color:#1A3D64;font-size:22px;text-align:center;">{{prenom}}, tu es &agrave; mi-chemin &mdash; impressionnant&nbsp;!</h2>
      <div style="background:#EEF6FA;border-radius:8px;padding:16px 20px;margin:20px 0 24px;text-align:center;">
        <p style="margin:0;font-size:32px;font-weight:bold;color:#1D546C;">{{percent}}%</p>
        <p style="margin:4px 0 0;font-size:13px;color:#888;">de progression accomplie</p>
      </div>
      <p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.7;text-align:center;">La moiti&eacute; du <em>{{marathonTitre}}</em> est derri&egrave;re toi. <strong>{{percent}}%</strong> accomplis&nbsp;! Ta pers&eacute;v&eacute;rance honore Dieu. L&rsquo;autre moiti&eacute; t&rsquo;attend avec encore plus de tr&eacute;sors.</p>
      <div style="background:#FFF8E7;border:1px solid #f0d080;border-radius:8px;padding:16px 20px;margin:0 0 28px;text-align:center;">
        <p style="margin:0 0 6px;font-size:13px;color:#999;font-style:italic;">Un verset pour t&rsquo;encourager</p>
        <p style="margin:0;font-size:15px;color:#444;line-height:1.6;">&laquo;&nbsp;Ne nous lassons pas de faire le bien&nbsp;; car nous moissonnerons au temps convenable, si nous ne nous rel&acirc;chons pas.&nbsp;&raquo;</p>
        <p style="margin:8px 0 0;font-size:13px;color:#888;"><em>Galates 6:9</em></p>
      </div>
      <p style="text-align:center;margin:0 0 24px;">
        <a href="${dashboard}" style="display:inline-block;background:linear-gradient(135deg,#1D546C,#1A3D64);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:15px;font-weight:bold;">Voir ma progression &rarr;</a>
      </p>
      <p style="margin:0;font-size:14px;color:#666;text-align:center;">Avec foi en toi,<br/><strong style="color:#1A3D64;">L&rsquo;&eacute;quipe CMCIEA France</strong></p>`,
      }],
      ['encouragement_75', {
        label: 'Encouragement 75%',
        description: 'Envoyé quand le participant atteint 75% du marathon.',
        variables: ['prenom', 'marathonTitre', 'percent'],
        subject: '⚡ {{percent}}% accompli – {{marathonTitre}}',
        body: `<p style="font-size:40px;margin:0 0 8px;text-align:center;">⚡</p>
      <h2 style="margin:0 0 8px;color:#1A3D64;font-size:22px;text-align:center;">{{prenom}}, la ligne d&rsquo;arriv&eacute;e est en vue&nbsp;!</h2>
      <div style="background:#EEF6FA;border-radius:8px;padding:16px 20px;margin:20px 0 24px;text-align:center;">
        <p style="margin:0;font-size:32px;font-weight:bold;color:#1D546C;">{{percent}}%</p>
        <p style="margin:4px 0 0;font-size:13px;color:#888;">de progression accomplie</p>
      </div>
      <p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.7;text-align:center;"><strong>{{percent}}%</strong> du <em>{{marathonTitre}}</em> accomplis &mdash; tu es dans le dernier quart&nbsp;! Tiens bon, l&rsquo;attestation t&rsquo;attend de l&rsquo;autre c&ocirc;t&eacute;.</p>
      <div style="background:#FFF8E7;border:1px solid #f0d080;border-radius:8px;padding:16px 20px;margin:0 0 28px;text-align:center;">
        <p style="margin:0 0 6px;font-size:13px;color:#999;font-style:italic;">Un verset pour t&rsquo;encourager</p>
        <p style="margin:0;font-size:15px;color:#444;line-height:1.6;">&laquo;&nbsp;J&rsquo;ai combattu le bon combat, j&rsquo;ai achev&eacute; la course, j&rsquo;ai gard&eacute; la foi.&nbsp;&raquo;</p>
        <p style="margin:8px 0 0;font-size:13px;color:#888;"><em>2 Timoth&eacute;e 4:7</em></p>
      </div>
      <p style="text-align:center;margin:0 0 24px;">
        <a href="${dashboard}" style="display:inline-block;background:linear-gradient(135deg,#1D546C,#1A3D64);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:15px;font-weight:bold;">Voir ma progression &rarr;</a>
      </p>
      <p style="margin:0;font-size:14px;color:#666;text-align:center;">Avec foi en toi,<br/><strong style="color:#1A3D64;">L&rsquo;&eacute;quipe CMCIEA France</strong></p>`,
      }],
      ['attestation_marathon', {
        label: 'Attestation Marathon (100%)',
        description: 'Envoyé avec le PDF quand un participant termine un marathon à 100%.',
        variables: ['prenom', 'fullName', 'marathonTitre', 'dateDebut', 'dateFin', 'rankLine'],
        subject: '🏆 Félicitations – Tu as terminé le {{marathonTitre}} !',
        body: `<div style="text-align:center;margin-bottom:24px;">
        <p style="font-size:48px;margin:0 0 8px;">🏆</p>
        <h2 style="margin:0 0 4px;color:#1A3D64;font-size:24px;">{{prenom}}, tu as termin&eacute; le Marathon&nbsp;!</h2>
        <p style="margin:0;color:#888;font-size:14px;">F&eacute;licitations pour cette r&eacute;alisation extraordinaire</p>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #c8a84b;border-radius:10px;margin:0 0 28px;overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#fffbf0,#fff8e1);padding:28px;text-align:center;">
          <p style="margin:0 0 6px;font-size:11px;color:#a08840;text-transform:uppercase;letter-spacing:2px;">Attestation de Participation</p>
          <p style="margin:0 0 10px;font-size:13px;color:#888;">La CMCIEA-FRANCE certifie que</p>
          <h3 style="margin:0 0 10px;color:#1A3D64;font-size:22px;font-weight:bold;">{{fullName}}</h3>
          <p style="margin:0 0 4px;font-size:13px;color:#888;">a compl&eacute;t&eacute; int&eacute;gralement le</p>
          <p style="margin:0 0 10px;font-size:17px;font-weight:bold;color:#1D546C;">{{marathonTitre}}</p>
          <p style="margin:0;font-size:13px;color:#888;">Du <strong>{{dateDebut}}</strong> au <strong>{{dateFin}}</strong></p>
        </td></tr>
      </table>
      {{rankLine}}
      <div style="background:#EEF6FA;border:1px solid #b0d4e8;border-radius:8px;padding:12px 20px;margin:0 0 20px;text-align:center;">
        <p style="margin:0;font-size:13px;color:#555;">Ton <strong>attestation officielle en PDF</strong> est jointe &agrave; cet email. Tu peux la t&eacute;l&eacute;charger et la conserver.</p>
      </div>
      <div style="background:#FFF8E7;border:1px solid #f0d080;border-radius:8px;padding:16px 20px;margin:0 0 28px;text-align:center;">
        <p style="margin:0;font-size:15px;color:#444;line-height:1.7;">&laquo;&nbsp;Ta parole est une lampe &agrave; mes pieds, et une lumi&egrave;re sur mon sentier.&nbsp;&raquo;</p>
        <p style="margin:8px 0 0;font-size:13px;color:#888;"><em>Psaumes 119:105</em></p>
      </div>
      <p style="text-align:center;margin:0 0 24px;">
        <a href="${dashboard}" style="display:inline-block;background:linear-gradient(135deg,#c8a84b,#e8c860);color:#1A3D64;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:15px;font-weight:bold;">Voir mon espace participant &rarr;</a>
      </p>
      <p style="margin:0;font-size:14px;color:#666;text-align:center;line-height:1.6;">Avec toute notre admiration,<br/><strong style="color:#1A3D64;">L&rsquo;&eacute;quipe CMCIEA France</strong></p>`,
      }],
      ['attestation_annuelle', {
        label: 'Attestation Annuelle',
        description: 'Envoyé par l\'admin pour récompenser la fidélité annuelle.',
        variables: ['prenom', 'fullName', 'annee', 'nbMarathons'],
        subject: '🌟 Attestation de fidélité {{annee}} – CMCIEA France',
        body: `<div style="text-align:center;margin-bottom:24px;">
        <p style="font-size:48px;margin:0 0 8px;">🌟</p>
        <h2 style="margin:0 0 4px;color:#1A3D64;font-size:24px;">{{prenom}}, quelle ann&eacute;e de fid&eacute;lit&eacute;&nbsp;!</h2>
        <p style="margin:0;color:#888;font-size:14px;">Attestation de fid&eacute;lit&eacute; {{annee}}</p>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #1D546C;border-radius:10px;margin:0 0 28px;overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#eef6fa,#e0f0f8);padding:28px;text-align:center;">
          <p style="margin:0 0 6px;font-size:11px;color:#1D546C;text-transform:uppercase;letter-spacing:2px;">Attestation de Fid&eacute;lit&eacute; {{annee}}</p>
          <p style="margin:0 0 10px;font-size:13px;color:#888;">La CMCIEA-FRANCE certifie que</p>
          <h3 style="margin:0 0 10px;color:#1A3D64;font-size:22px;font-weight:bold;">{{fullName}}</h3>
          <p style="margin:0 0 4px;font-size:13px;color:#888;">a particip&eacute; fid&egrave;lement aux</p>
          <p style="margin:0 0 4px;font-size:28px;font-weight:bold;color:#1D546C;">{{nbMarathons}}</p>
          <p style="margin:0;font-size:14px;color:#555;">marathon(s) biblique(s) organis&eacute;(s) en <strong>{{annee}}</strong></p>
        </td></tr>
      </table>
      <div style="background:#FFF8E7;border:1px solid #f0d080;border-radius:8px;padding:16px 20px;margin:0 0 28px;text-align:center;">
        <p style="margin:0;font-size:15px;color:#444;line-height:1.7;">&laquo;&nbsp;Heureux l&rsquo;homme&hellip; qui trouve son plaisir dans la loi de l&rsquo;&Eacute;ternel, et qui la m&eacute;dite jour et nuit&nbsp;!&nbsp;&raquo;</p>
        <p style="margin:8px 0 0;font-size:13px;color:#888;"><em>Psaumes 1:1-2</em></p>
      </div>
      <p style="text-align:center;margin:0 0 24px;">
        <a href="${dashboard}" style="display:inline-block;background:linear-gradient(135deg,#1D546C,#1A3D64);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:15px;font-weight:bold;">Mon tableau de bord &rarr;</a>
      </p>
      <p style="margin:0;font-size:14px;color:#666;text-align:center;line-height:1.6;">Merci pour ta fid&eacute;lit&eacute; en {{annee}}, {{prenom}}&nbsp;!<br/><strong style="color:#1A3D64;">L&rsquo;&eacute;quipe CMCIEA France</strong></p>`,
      }],
      ['confirmation_departement', {
        label: 'Confirmation Département',
        description: 'Envoyé quand quelqu\'un demande à rejoindre un département.',
        variables: ['prenom', 'nom', 'email', 'departement', 'extras'],
        subject: 'Bienvenue dans le {{departement}} – CMCIEA France 🙏',
        body: `<h2 style="margin:0 0 8px;color:#1A3D64;font-size:22px;">Bienvenue, {{prenom}}&nbsp;! 🙏</h2>
      <p style="margin:0 0 20px;color:#555;font-size:15px;line-height:1.6;">
        Ta demande de rejoindre le <strong style="color:#1D546C;">{{departement}}</strong> a bien &eacute;t&eacute; re&ccedil;ue.
        Notre &eacute;quipe prendra contact avec toi tr&egrave;s prochainement pour t&rsquo;accueillir.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#EEF6FA;border-left:4px solid #00B7B5;border-radius:6px;margin:0 0 24px;">
        <tr><td style="padding:16px 20px;">
          <p style="margin:0 0 8px;font-size:14px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">R&eacute;capitulatif</p>
          <ul style="margin:0;padding-left:20px;color:#333;font-size:14px;line-height:1.9;">
            <li><strong>Nom :</strong> {{prenom}} {{nom}}</li>
            <li><strong>Email :</strong> {{email}}</li>
            <li><strong>D&eacute;partement :</strong> {{departement}}</li>
            {{extras}}
          </ul>
        </td></tr>
      </table>
      <div style="background:#FFF8E7;border:1px solid #f0d080;border-radius:8px;padding:16px 20px;margin:0 0 28px;text-align:center;">
        <p style="margin:0;font-size:15px;color:#444;line-height:1.6;">&laquo;&nbsp;L&rsquo;assemblage ensemble est une force &mdash; continuez de vous encourager les uns les autres.&nbsp;&raquo;</p>
        <p style="margin:8px 0 0;font-size:13px;color:#888;"><em>H&eacute;breux 10:25</em></p>
      </div>
      <p style="text-align:center;margin:0 0 24px;">
        <a href="https://cmciea-france.com/departements" style="display:inline-block;background:linear-gradient(135deg,#1D546C,#1A3D64);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:15px;font-weight:bold;">D&eacute;couvrir nos d&eacute;partements &rarr;</a>
      </p>
      <p style="margin:0;font-size:14px;color:#666;line-height:1.6;">Avec joie de t&rsquo;accueillir parmi nous&nbsp;!<br/><br/><strong style="color:#1A3D64;">L&rsquo;&eacute;quipe CMCIEA France</strong></p>`,
      }],
    ]);
  }

  private renderTemplate(text: string, vars: Record<string, string>): string {
    let result = text;
    for (const [k, v] of Object.entries(vars)) {
      result = result.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
    }
    return result;
  }

  private async getTemplate(
    key: string,
    vars: Record<string, string>,
  ): Promise<{ subject: string; body: string }> {
    const defaults = this.defaultTemplates();
    const def = defaults.get(key);
    let subject = def?.subject ?? '';
    let body    = def?.body    ?? '';

    try {
      const doc = await this.firebase.firestore.doc(`${TEMPLATE_COL}/${key}`).get();
      if (doc.exists) {
        const data = doc.data()!;
        if (data['subject']) subject = data['subject'];
        if (data['body'])    body    = data['body'];
      }
    } catch (err) {
      this.logger.warn(`Failed to load email template "${key}" from Firestore`, err);
    }

    return {
      subject: this.renderTemplate(subject, vars),
      body:    this.renderTemplate(body,    vars),
    };
  }

  // ─── Public template CRUD (for admin) ─────────────────────────────────────

  async listTemplates(): Promise<EmailTemplate[]> {
    const defaults = this.defaultTemplates();
    const result: EmailTemplate[] = [];

    for (const [key, def] of defaults) {
      let customized = false;
      let updatedAt: string | undefined;
      try {
        const doc = await this.firebase.firestore.doc(`${TEMPLATE_COL}/${key}`).get();
        if (doc.exists) {
          customized = true;
          updatedAt  = doc.data()?.['updatedAt'];
        }
      } catch { /* ignore */ }
      result.push({ key, ...def, customized, updatedAt });
    }
    return result;
  }

  async getTemplateForAdmin(key: string): Promise<EmailTemplate | null> {
    const defaults = this.defaultTemplates();
    const def = defaults.get(key);
    if (!def) return null;

    let subject = def.subject;
    let body    = def.body;
    let customized = false;
    let updatedAt: string | undefined;

    try {
      const doc = await this.firebase.firestore.doc(`${TEMPLATE_COL}/${key}`).get();
      if (doc.exists) {
        const data = doc.data()!;
        if (data['subject']) subject = data['subject'];
        if (data['body'])    body    = data['body'];
        customized = true;
        updatedAt  = data['updatedAt'];
      }
    } catch { /* use defaults */ }

    return { key, ...def, subject, body, customized, updatedAt };
  }

  async saveTemplate(key: string, subject: string, body: string): Promise<void> {
    const defaults = this.defaultTemplates();
    if (!defaults.has(key)) throw new Error(`Unknown template key: ${key}`);
    await this.firebase.firestore.doc(`${TEMPLATE_COL}/${key}`).set({
      subject,
      body,
      updatedAt: new Date().toISOString(),
    });
  }

  async resetTemplate(key: string): Promise<void> {
    await this.firebase.firestore.doc(`${TEMPLATE_COL}/${key}`).delete();
  }

  // ─── General inscriptions ──────────────────────────────────────────────────

  async sendConfirmationInscription(dto: CreateInscriptionDto) {
    if (!this.canSendMail()) return;

    if (dto.type === InscriptionType.DEPARTEMENT) {
      return this.sendConfirmationDepartement(dto);
    }

    const labels: Record<string, string> = {
      [InscriptionType.MARATHON]:         'Marathon Biblique',
      [InscriptionType.CULTE]:            'Venir au culte',
      [InscriptionType.LECTURE_BIBLIQUE]: 'Lecture biblique (Telegram)',
    };

    const label = labels[dto.type] ?? dto.type;
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

  private async sendConfirmationDepartement(dto: CreateInscriptionDto) {
    const dept = dto.departement ?? 'un département';

    let extras = '';
    if (dto.enfantPrenom) extras += `<li><strong>Enfant :</strong> ${dto.enfantPrenom}${dto.enfantAge ? ', ' + dto.enfantAge + ' ans' : ''}</li>`;
    if (dto.universite)   extras += `<li><strong>Universit&eacute; :</strong> ${dto.universite}</li>`;
    if (dto.typeVoix)     extras += `<li><strong>Type de voix :</strong> ${dto.typeVoix}</li>`;
    if (dto.telephone)    extras += `<li><strong>T&eacute;l&eacute;phone :</strong> ${dto.telephone}</li>`;

    const { subject, body } = await this.getTemplate('confirmation_departement', {
      prenom:      dto.prenom,
      nom:         dto.nom,
      email:       dto.email,
      departement: dept,
      extras,
    });

    await this.resend!.emails.send({
      from: this.from,
      to: dto.email,
      subject,
      html: this.emailShell(body),
    }).catch(err => this.logger.error('Mail confirmation département', err));
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

  // ─── Marathon emails ───────────────────────────────────────────────────────

  async sendBienvenueMarathon(to: string, fullName: string, marathon: any) {
    if (!this.canSendMail()) return;
    const { subject, body } = await this.getTemplate('bienvenue_marathon', {
      prenom:        fullName.split(' ')[0],
      fullName,
      marathonTitre: marathon.titre,
      dateDebut:     marathon.dateDebut,
      dateFin:       marathon.dateFin,
      nbJours:       String(marathon.nbJours ?? ''),
      description:   marathon.description ?? '',
    });
    await this.resend!.emails.send({
      from: this.from, to, subject, html: this.emailShell(body),
    }).catch(err => this.logger.error('Mail bienvenue marathon', err));
  }

  async sendEncouragementMarathon(to: string, fullName: string, marathon: any, percent: number) {
    if (!this.canSendMail()) return;
    const key = `encouragement_${percent}` as 'encouragement_25' | 'encouragement_50' | 'encouragement_75';
    const defaults = this.defaultTemplates();
    if (!defaults.has(key)) return;
    const { subject, body } = await this.getTemplate(key, {
      prenom:        fullName.split(' ')[0],
      marathonTitre: marathon.titre,
      percent:       String(percent),
    });
    await this.resend!.emails.send({
      from: this.from, to, subject, html: this.emailShell(body),
    }).catch(err => this.logger.error('Mail encouragement marathon', err));
  }

  async sendAttestationMarathon(
    to: string,
    fullName: string,
    marathon: any,
    rank: number | null = null,
    totalParticipants: number | null = null,
  ) {
    if (!this.canSendMail()) return;

    const rankLine = rank && totalParticipants
      ? `<p style="margin:0 0 16px;font-size:14px;color:#1D546C;font-weight:bold;text-align:center;">Classement final&nbsp;: #${rank} sur ${totalParticipants} participants</p>`
      : '';

    const { subject, body } = await this.getTemplate('attestation_marathon', {
      prenom:            fullName.split(' ')[0],
      fullName,
      marathonTitre:     marathon.titre,
      dateDebut:         marathon.dateDebut,
      dateFin:           marathon.dateFin,
      rankLine,
    });

    // Generate PDF certificate
    let pdfBuffer: Buffer | undefined;
    try {
      pdfBuffer = await this.generateCertificatePdf({
        fullName,
        marathonTitre: marathon.titre,
        dateDebut: marathon.dateDebut,
        dateFin: marathon.dateFin,
        rank,
        totalParticipants,
      });
    } catch (err) {
      this.logger.error('PDF generation failed', err);
    }

    await this.resend!.emails.send({
      from: this.from,
      to,
      subject,
      html: this.emailShell(body),
      ...(pdfBuffer ? {
        attachments: [{
          filename: `attestation-${marathon.titre.replace(/\s+/g, '-').toLowerCase()}.pdf`,
          content: pdfBuffer,
        }],
      } : {}),
    } as any).catch(err => this.logger.error('Mail attestation marathon', err));
  }

  async sendAttestationAnnuelle(to: string, fullName: string, annee: number, nbMarathons: number) {
    if (!this.canSendMail()) return;
    const { subject, body } = await this.getTemplate('attestation_annuelle', {
      prenom:       fullName.split(' ')[0],
      fullName,
      annee:        String(annee),
      nbMarathons:  String(nbMarathons),
    });
    await this.resend!.emails.send({
      from: this.from, to, subject, html: this.emailShell(body),
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

  async sendCulteAnnonce(
    to: string,
    sujet: string,
    message: string,
    date: string,
    flyerUrl: string | null,
  ) {
    if (!this.canSendMail()) return;

    const flyerBlock = flyerUrl
      ? `<div style="text-align:center;margin:20px 0;">
           <img src="${flyerUrl}" alt="Flyer culte" style="max-width:100%;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.15);"/>
         </div>`
      : '';

    const body = `
      <h2 style="margin:0 0 8px;color:#1A3D64;font-size:22px;">&#128197; ${sujet}</h2>
      <p style="margin:0 0 20px;color:#555;font-size:15px;line-height:1.6;">${message.replace(/\n/g, '<br/>')}</p>
      <div style="background:#EEF6FA;border-left:4px solid #00B7B5;border-radius:6px;padding:16px 20px;margin:0 0 24px;">
        <p style="margin:0;font-size:16px;font-weight:bold;color:#1A3D64;">&#128338; ${date}</p>
      </div>
      ${flyerBlock}
      <p style="text-align:center;margin:24px 0;">
        <a href="https://cmciea-france.com" style="display:inline-block;background:linear-gradient(135deg,#1D546C,#1A3D64);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:15px;font-weight:bold;">
          Visiter le site &rarr;
        </a>
      </p>
      <p style="margin:0;font-size:14px;color:#666;text-align:center;line-height:1.6;">
        Que le Seigneur vous b&eacute;nisse,<br/>
        <strong style="color:#1A3D64;">L&rsquo;&eacute;quipe CMCIEA France</strong>
      </p>
    `;

    await this.resend!.emails.send({
      from: this.from,
      to,
      subject: sujet,
      html: this.emailShell(body),
    }).catch(err => this.logger.error('Mail culte annonce', err));
  }
}
