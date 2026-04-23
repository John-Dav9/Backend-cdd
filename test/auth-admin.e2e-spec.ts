import { INestApplication } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { ActualitesController } from '../src/actualites/actualites.controller';
import { ActualitesService } from '../src/actualites/actualites.service';
import { FirebaseAuthGuard } from '../src/auth/firebase-auth.guard';
import { FirebaseService } from '../src/firebase/firebase.service';
import { SettingsController } from '../src/settings/settings.controller';
import { SettingsService } from '../src/settings/settings.service';
import { ConfigService } from '@nestjs/config';

describe('Auth + Admin routes (e2e)', () => {
  let app: INestApplication;

  const actualitesServiceMock = {
    findAll: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue({ id: '1' }),
    create: jest.fn().mockResolvedValue({ id: '1' }),
    update: jest.fn().mockResolvedValue({ message: 'ok' }),
    remove: jest.fn().mockResolvedValue({ message: 'ok' }),
  };

  const settingsServiceMock = {
    getTheme: jest.fn().mockResolvedValue({ brand: '#1D546C' }),
    updateTheme: jest.fn().mockResolvedValue({ brand: '#1D546C' }),
    uploadThemeImage: jest.fn().mockResolvedValue({ url: 'https://example.test/logo.png' }),
    getCultes: jest.fn().mockResolvedValue([]),
    updateCultes: jest.fn().mockResolvedValue([]),
    getPage: jest.fn().mockResolvedValue({}),
    updatePage: jest.fn().mockResolvedValue({}),
    uploadPageImage: jest.fn().mockResolvedValue({ url: 'https://example.test/page.png' }),
  };

  const firebaseServiceMock = {
    auth: {
      verifyIdToken: jest.fn(async (token: string) => {
        if (token === 'firebase-valid-token') {
          return { uid: 'firebase-user', email: 'user@test.dev' };
        }
        throw new Error('invalid');
      }),
    },
  };

  const configValues: Record<string, string> = {
    DEV_ADMIN_ENABLED: 'true',
    DEV_ADMIN_TOKEN: 'dev-admin-token-change-me',
    DEV_ADMIN_EMAIL: 'admin-dev@local.test',
    NODE_ENV: 'development',
  };

  const configServiceMock = {
    get: jest.fn((key: string, defaultValue?: string) => {
      if (key in configValues) return configValues[key];
      return defaultValue;
    }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ActualitesController, SettingsController],
      providers: [
        Reflector,
        { provide: ActualitesService, useValue: actualitesServiceMock },
        { provide: SettingsService, useValue: settingsServiceMock },
        { provide: FirebaseService, useValue: firebaseServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
        {
          provide: APP_GUARD,
          useClass: FirebaseAuthGuard,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows public route without auth token', async () => {
    await request(app.getHttpServer()).get('/actualites').expect(200);
  });

  it('blocks admin route without token', async () => {
    await request(app.getHttpServer()).get('/actualites/admin/all').expect(401);
  });

  it('allows admin route with valid Firebase token', async () => {
    await request(app.getHttpServer())
      .get('/actualites/admin/all')
      .set('Authorization', 'Bearer firebase-valid-token')
      .expect(200);
  });

  it('allows admin route with dev token from localhost only', async () => {
    await request(app.getHttpServer())
      .get('/actualites/admin/all')
      .set('Authorization', 'Bearer dev-admin-token-change-me')
      .set('x-forwarded-for', '127.0.0.1')
      .expect(200);
  });

  it('rejects dev token from non-localhost source', async () => {
    await request(app.getHttpServer())
      .get('/actualites/admin/all')
      .set('Authorization', 'Bearer dev-admin-token-change-me')
      .set('x-forwarded-for', '10.10.10.10')
      .expect(403);
  });

  it('protects critical admin settings update endpoint', async () => {
    await request(app.getHttpServer())
      .patch('/settings/theme')
      .send({ brand: '#000000' })
      .expect(401);
  });
});
