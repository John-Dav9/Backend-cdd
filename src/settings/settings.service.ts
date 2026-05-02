import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Actualite } from '../database/entities/actualite.entity';
import { EmailTemplate } from '../database/entities/email-template.entity';
import { Inscription } from '../database/entities/inscription.entity';
import { MarathonInscription } from '../database/entities/marathon-inscription.entity';
import { Setting } from '../database/entities/setting.entity';
import { MailService } from '../mail/mail.service';
import { StorageService } from '../storage/storage.service';

type UploadedFile = { originalname: string; mimetype: string; buffer: Buffer };

export const DEFAULT_CULTES = [
  { id: '1', jour: 'DU LUNDI AU VENDREDI', heure: '12H30 – 13H30', description: 'PRIÈRE EN LIGNE' },
  { id: '2', jour: 'DIMANCHE',              heure: '17H – 18H',     description: 'CÉLÉBRATION EN LIGNE' },
  { id: '3', jour: 'MERCREDI',              heure: '20H – 21H',     description: 'ENSEIGNEMENTS BIBLIQUES EN LIGNE' },
  { id: '4', jour: 'VENDREDI',              heure: '23H – 1H',      description: 'NUIT DE PRIÈRE EN LIGNE' },
];

export const DEFAULT_THEME = {
  brand: '#1D546C', brandSecondary: '#1A3D64', cta: '#0C2B4E', accent: '#00B7B5',
  primaryBg: '#F4F4F4', surface: '#FFFFFF', text: '#111111', muted: '#334155',
  fontHeading: 'Lora', fontBody: 'Inter', logoUrl: null as string | null,
};

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    @InjectRepository(Setting) private settingRepo: Repository<Setting>,
    @InjectRepository(EmailTemplate) private templateRepo: Repository<EmailTemplate>,
    @InjectRepository(MarathonInscription) private marathonInscRepo: Repository<MarathonInscription>,
    @InjectRepository(Inscription) private inscRepo: Repository<Inscription>,
    private mail: MailService,
    private storage: StorageService,
  ) {}

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async getSetting<T>(key: string, defaultValue: T): Promise<T> {
    try {
      const row = await this.settingRepo.findOne({ where: { key } });
      return row ? (row.value as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  private async setSetting(key: string, value: any): Promise<void> {
    await this.settingRepo.save({ key, value });
  }

  // ── Theme ────────────────────────────────────────────────────────────────

  async getTheme() {
    return this.getSetting('theme', DEFAULT_THEME);
  }

  async updateTheme(data: Partial<typeof DEFAULT_THEME>) {
    const current = await this.getTheme();
    await this.setSetting('theme', { ...current, ...data });
    return this.getTheme();
  }

  async uploadThemeImage(field: 'logoUrl' | 'heroImageUrl', file: UploadedFile) {
    const path = `settings/${field}_${Date.now()}_${file.originalname}`;
    const url  = await this.storage.upload(path, file.buffer, file.mimetype);
    await this.updateTheme({ [field]: url } as any);
    return { url };
  }

  // ── Cultes ───────────────────────────────────────────────────────────────

  async getCultes() {
    return this.getSetting('cultes', DEFAULT_CULTES);
  }

  async updateCultes(items: any[]) {
    await this.setSetting('cultes', items);
    return items;
  }

  // ── Prochain culte ───────────────────────────────────────────────────────

  async getNextCulte() {
    return this.getSetting<any>('next_culte', null);
  }

  async updateNextCulte(data: { sujet: string; date: string; message: string }, actualiteRepo: Repository<Actualite>) {
    await this.setSetting('next_culte', data);

    await actualiteRepo.save(actualiteRepo.create({
      titre: `Prochain culte en présentiel : ${data.sujet}`,
      contenu: `${data.message}\n\nDate : ${data.date}`,
      auteur: 'Administration',
      publiee: true,
      tags: ['culte', 'présentiel'],
    }));

    this.broadcastNextCulte().catch(err => this.logger.error('Broadcast culte failed', err));
    return this.getNextCulte();
  }

  async uploadNextCulteFlyer(file: UploadedFile) {
    const path = `settings/next_culte_flyer_${Date.now()}_${file.originalname}`;
    const url  = await this.storage.upload(path, file.buffer, file.mimetype);
    const current = (await this.getNextCulte()) ?? {};
    await this.setSetting('next_culte', { ...current, flyerUrl: url });
    return { url };
  }

  async broadcastNextCulte(): Promise<{ envoyes: number }> {
    const culte = await this.getNextCulte();
    if (!culte) return { envoyes: 0 };

    const [marathon, inscs] = await Promise.all([
      this.marathonInscRepo.find({ select: ['email'] }),
      this.inscRepo.find({ select: ['email'] }),
    ]);
    const emails = new Set([...marathon, ...inscs].map(i => i.email));

    let envoyes = 0;
    for (const email of emails) {
      await this.mail.sendCulteAnnonce(email, culte.sujet ?? '', culte.message ?? '', culte.date ?? '', culte.flyerUrl ?? null)
        .catch(err => this.logger.error('Mail culte broadcast', err));
      envoyes++;
    }
    return { envoyes };
  }

  // ── Pages ─────────────────────────────────────────────────────────────────

  async getPage(pageId: string) {
    return this.getSetting<any>(`page_${pageId}`, null);
  }

  async updatePage(pageId: string, data: Record<string, any>) {
    const current = (await this.getPage(pageId)) ?? {};
    await this.setSetting(`page_${pageId}`, { ...current, ...data });
    return this.getPage(pageId);
  }

  async uploadPageImage(pageId: string, field: string, file: UploadedFile) {
    const path = `pages/${pageId}/${field}_${Date.now()}_${file.originalname}`;
    const url  = await this.storage.upload(path, file.buffer, file.mimetype);
    await this.updatePage(pageId, { [field]: url });
    return { url };
  }

  // ── Email templates ───────────────────────────────────────────────────────

  async getTemplate(key: string) {
    return this.templateRepo.findOne({ where: { key } });
  }

  async upsertTemplate(key: string, subject: string, body: string) {
    const existing = await this.templateRepo.findOne({ where: { key } });
    if (existing) {
      await this.templateRepo.update(existing.id, { subject, body });
    } else {
      await this.templateRepo.save(this.templateRepo.create({ key, subject, body }));
    }
    return this.templateRepo.findOne({ where: { key } });
  }

  async deleteTemplate(key: string) {
    await this.templateRepo.delete({ key });
    return { message: 'Template supprimé' };
  }

  async getAllTemplates() {
    return this.templateRepo.find({ order: { key: 'ASC' } });
  }
}
