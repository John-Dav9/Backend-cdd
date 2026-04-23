import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private app: admin.app.App | null = null;
  private readonly logger = new Logger(FirebaseService.name);

  constructor(private config: ConfigService) {}

  private get hasValidCredentials(): boolean {
    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.config.get<string>('FIREBASE_PRIVATE_KEY');

    if (!projectId || !clientEmail || !privateKey) {
      return false;
    }

    if (privateKey.includes('...')) {
      return false;
    }

    return true;
  }

  onModuleInit() {
    if (!this.hasValidCredentials) {
      this.logger.warn(
        'Firebase credentials are missing or invalid in environment variables. Firebase features are disabled until configured.',
      );
      return;
    }

    if (!admin.apps.length) {
      this.app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: this.config.get('FIREBASE_PROJECT_ID'),
          clientEmail: this.config.get('FIREBASE_CLIENT_EMAIL'),
          privateKey: this.config
            .get<string>('FIREBASE_PRIVATE_KEY')
            .replace(/\\n/g, '\n'),
        }),
        storageBucket: this.config.get('FIREBASE_STORAGE_BUCKET'),
      });
    } else {
      this.app = admin.app();
    }
  }

  get isReady(): boolean { return this.app !== null; }

  private ensureInitialized(): void {
    if (!this.app) {
      throw new Error(
        'Firebase is not initialized. Configure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.',
      );
    }
  }

  get firestore(): admin.firestore.Firestore {
    this.ensureInitialized();
    return admin.firestore();
  }

  get auth(): admin.auth.Auth {
    this.ensureInitialized();
    return admin.auth();
  }

  get storage(): admin.storage.Storage {
    this.ensureInitialized();
    return admin.storage();
  }
}
