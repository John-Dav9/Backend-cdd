import { INestApplication } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';
import { ActualitesController } from '../src/actualites/actualites.controller';
import { ActualitesService } from '../src/actualites/actualites.service';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { RolesGuard } from '../src/auth/roles.guard';
import { TokenRevocationService } from '../src/auth/token-revocation.service';
import { Member } from '../src/database/entities/member.entity';
import { User } from '../src/database/entities/user.entity';

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
        return { sub: 'admin-id', email: 'admin@example.test', role: 'admin', jti: 'active-jti' };
      }
      if (token === 'revoked-admin-token') {
        return { sub: 'admin-id', email: 'admin@example.test', role: 'admin', jti: 'revoked-jti' };
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
        {
          provide: TokenRevocationService,
          useValue: { isRevoked: jest.fn(async (jti: string) => jti === 'revoked-jti') },
        },
        {
          provide: getRepositoryToken(Member),
          useValue: {
            findOne: jest.fn(async ({ where }: any) => where.id === 'member-id'
              ? {
                  id: 'member-id',
                  firstName: 'Jean',
                  lastName: 'Membre',
                  email: 'member@example.test',
                  role: 'member',
                  isActive: true,
                }
              : null),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(async ({ where }: any) => where.id === 'admin-id'
              ? {
                  id: 'admin-id',
                  email: 'admin@example.test',
                  fullName: 'Administrateur principal',
                  role: 'super_admin',
                }
              : null),
          },
        },
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

  it('rejects a revoked admin session', async () => {
    await request(app.getHttpServer())
      .get('/actualites/admin/all')
      .set('Authorization', 'Bearer revoked-admin-token')
      .expect(401);
  });

  it('allows an admin token on an admin route', async () => {
    await request(app.getHttpServer())
      .get('/actualites/admin/all')
      .set('Authorization', 'Bearer admin-token')
      .expect(200);
  });
});
