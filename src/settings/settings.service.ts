import { Injectable, Logger } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { MailService } from '../mail/mail.service';

const THEME_DOC        = 'settings/theme';
const NEXT_CULTE_DOC   = 'settings/next_culte';
const PAGE_DOC = (id: string) => `settings/page_${id}`;

type UploadedFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

export const DEFAULT_CULTES = [
  { id: '1', jour: 'DU LUNDI AU VENDREDI', heure: '12H30 – 13H30', description: 'PRIÈRE EN LIGNE' },
  { id: '2', jour: 'DIMANCHE',              heure: '17H – 18H',     description: 'CÉLÉBRATION EN LIGNE' },
  { id: '3', jour: 'MERCREDI',              heure: '20H – 21H',     description: 'ENSEIGNEMENTS BIBLIQUES EN LIGNE' },
  { id: '4', jour: 'VENDREDI',              heure: '23H – 1H',      description: 'NUIT DE PRIÈRE EN LIGNE' },
];

export const DEFAULT_THEME = {
  brand: '#1D546C',
  brandSecondary: '#1A3D64',
  cta: '#0C2B4E',
  accent: '#00B7B5',
  primaryBg: '#F4F4F4',
  surface: '#FFFFFF',
  text: '#111111',
  muted: '#334155',
  fontHeading: 'Lora',
  fontBody: 'Inter',
  logoUrl: null as string | null,
};

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    private firebase: FirebaseService,
    private mail: MailService,
  ) {}

  // ── Theme ────────────────────────────────────────────
  async getTheme() {
    try {
      const snap = await this.firebase.firestore.doc(THEME_DOC).get();
      return snap.exists ? { ...DEFAULT_THEME, ...snap.data() } : DEFAULT_THEME;
    } catch {
      return DEFAULT_THEME;
    }
  }

  async updateTheme(data: Partial<typeof DEFAULT_THEME>) {
    await this.firebase.firestore.doc(THEME_DOC).set(data, { merge: true });
    return this.getTheme();
  }

  async uploadThemeImage(field: 'logoUrl' | 'heroImageUrl', file: UploadedFile) {
    const bucket = this.firebase.storage.bucket();
    const path = `settings/${field}_${Date.now()}_${file.originalname}`;
    const ref = bucket.file(path);
    await ref.save(file.buffer, { contentType: file.mimetype });
    await ref.makePublic();
    const url = ref.publicUrl();
    await this.firebase.firestore.doc(THEME_DOC).set({ [field]: url }, { merge: true });
    return { url };
  }

  // ── Cultes (service schedule) ────────────────────────
  async getCultes() {
    try {
      const snap = await this.firebase.firestore.doc('settings/cultes').get();
      return snap.exists ? (snap.data()?.items ?? DEFAULT_CULTES) : DEFAULT_CULTES;
    } catch {
      return DEFAULT_CULTES;
    }
  }

  async updateCultes(items: any[]) {
    await this.firebase.firestore.doc('settings/cultes').set({ items });
    return items;
  }

  // ── Prochain culte présentiel ─────────────────────────
  async getNextCulte() {
    try {
      const snap = await this.firebase.firestore.doc(NEXT_CULTE_DOC).get();
      return snap.exists ? snap.data() : null;
    } catch {
      return null;
    }
  }

  async updateNextCulte(data: { sujet: string; date: string; message: string }) {
    await this.firebase.firestore.doc(NEXT_CULTE_DOC).set(data, { merge: true });

    // Auto-create an actualité for the culte announcement
    await this.firebase.firestore.collection('actualites').add({
      titre: `Prochain culte en présentiel : ${data.sujet}`,
      contenu: `${data.message}\n\nDate : ${data.date}`,
      auteur: 'Administration',
      publiee: true,
      tags: ['culte', 'présentiel'],
      imageUrl: null,
      videoId: null,
      createdAt: new Date().toISOString(),
    });

    // Auto-broadcast to all registered emails (fire-and-forget)
    this.broadcastNextCulte().catch(err =>
      this.logger.error('Auto-broadcast culte failed', err),
    );

    return this.getNextCulte();
  }

  async uploadNextCulteFlyer(file: UploadedFile) {
    const bucket = this.firebase.storage.bucket();
    const path = `settings/next_culte_flyer_${Date.now()}_${file.originalname}`;
    const ref = bucket.file(path);
    await ref.save(file.buffer, { contentType: file.mimetype });
    await ref.makePublic();
    const url = ref.publicUrl();
    await this.firebase.firestore.doc(NEXT_CULTE_DOC).set({ flyerUrl: url }, { merge: true });
    return { url };
  }

  async broadcastNextCulte(): Promise<{ envoyes: number }> {
    const snap = await this.firebase.firestore.doc(NEXT_CULTE_DOC).get();
    if (!snap.exists) return { envoyes: 0 };

    const culte = snap.data() as any;

    // Collecter tous les emails uniques (marathon + inscriptions générales)
    const [marathonSnap, inscSnap] = await Promise.all([
      this.firebase.firestore.collection('marathon_inscriptions').get(),
      this.firebase.firestore.collection('inscriptions').get(),
    ]);

    const emails = new Set<string>();
    marathonSnap.docs.forEach(d => { if (d.data()['email']) emails.add(d.data()['email']); });
    inscSnap.docs.forEach(d => { if (d.data()['email']) emails.add(d.data()['email']); });

    let envoyes = 0;
    for (const email of emails) {
      await this.mail
        .sendCulteAnnonce(email, culte.sujet ?? 'Prochain culte', culte.message ?? '', culte.date ?? '', culte.flyerUrl ?? null)
        .catch(err => this.logger.error('Mail culte broadcast', err));
      envoyes++;
    }

    return { envoyes };
  }

  // ── Page content ─────────────────────────────────────
  async getPage(pageId: string) {
    const snap = await this.firebase.firestore.doc(PAGE_DOC(pageId)).get();
    return snap.exists ? snap.data() : null;
  }

  async updatePage(pageId: string, data: Record<string, any>) {
    await this.firebase.firestore.doc(PAGE_DOC(pageId)).set(data, { merge: true });
    return this.getPage(pageId);
  }

  async uploadPageImage(pageId: string, field: string, file: UploadedFile) {
    const bucket = this.firebase.storage.bucket();
    const path = `pages/${pageId}/${field}_${Date.now()}_${file.originalname}`;
    const ref = bucket.file(path);
    await ref.save(file.buffer, { contentType: file.mimetype });
    await ref.makePublic();
    const url = ref.publicUrl();
    await this.firebase.firestore
      .doc(PAGE_DOC(pageId))
      .set({ [field]: url }, { merge: true });
    return { url };
  }
}
