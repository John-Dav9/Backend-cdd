import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';

const THEME_DOC = 'settings/theme';
const PAGE_DOC = (id: string) => `settings/page_${id}`;

type UploadedFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

export const DEFAULT_CULTES = [
  { id: '1', jour: 'DU LUNDI AU VENDREDI', heure: '12H30 \u2013 13H30', description: 'PRI\u00c8RE EN LIGNE' },
  { id: '2', jour: 'DIMANCHE',              heure: '17H \u2013 18H',     description: 'C\u00c9L\u00c9BRATION EN LIGNE' },
  { id: '3', jour: 'MERCREDI',              heure: '20H \u2013 21H',     description: 'ENSEIGNEMENTS BIBLIQUES EN LIGNE' },
  { id: '4', jour: 'VENDREDI',              heure: '23H \u2013 1H',      description: 'NUIT DE PRI\u00c8RE EN LIGNE' },
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
  constructor(private firebase: FirebaseService) {}

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
