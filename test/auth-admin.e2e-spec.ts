import { INestApplication } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { ActualitesController } from '../src/actualites/actualites.controller';
import { ActualitesService } from '../src/actualites/actualites.service';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { RolesGuard } from '../src/auth/roles.guard';

describe('JWT and role protected routes (e2e)', () => {
  let app: INestApplication;

  const actualitesServiceMock = {
    findAll: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue({ id: '1' }),
    create: jest.fn().mockResolvedValue({ id: '1' }),
    update: jest.fn().mockResolvedValue({ message: 'ok' }),
    remove: jest.fn().mockResolvedValue({ message: 'ok' }),
  };

  const jwtServiceMock = {
    verifyAsync: jest.fn(async (token: string) => {
      if (token === 'admin-token') {
        return { sub: 'admin-id', email: 'admin@example.test', role: 'admin' };
      }
      if (token === 'member-token') {
        return { sub: 'member-id', email: 'member@example.test', role: 'member', type: 'member' };
      }
      throw new Error('invalid token');
    }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ActualitesController],
      providers: [
        Reflector,
        { provide: ActualitesService, useValue: actualitesServiceMock },
        { provide: JwtService, useValue: jwtServiceMock },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows a public route without a token', async () => {
    await request(app.getHttpServer()).get('/actualites').expect(200);
  });

  it('rejects an admin route without a token', async () => {
    await request(app.getHttpServer()).get('/actualites/admin/all').expect(401);
  });

  it('rejects an invalid token', async () => {
    await request(app.getHttpServer())
      .get('/actualites/admin/all')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
  });

  it('rejects a member token on an admin route', async () => {
    await request(app.getHttpServer())
      .get('/actualites/admin/all')
      .set('Authorization', 'Bearer member-token')
      .expect(403);
  });

  it('allows an admin token on an admin route', async () => {
    await request(app.getHttpServer())
      .get('/actualites/admin/all')
      .set('Authorization', 'Bearer admin-token')
      .expect(200);
  });
});
