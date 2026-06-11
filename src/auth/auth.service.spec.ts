import * as bcrypt from 'bcryptjs';

jest.mock('../mail/mail.service', () => ({
  MailService: class MailService {},
}));

import { AuthService } from './auth.service';

describe('AuthService admin 2FA', () => {
  const user = {
    id: 'admin-id',
    email: 'admin@example.test',
    passwordHash: '',
    fullName: 'Admin',
    role: 'admin',
  } as any;

  let userRepo: any;
  let otpRepo: any;
  let jwtService: any;
  let mailService: any;
  let service: AuthService;

  beforeEach(async () => {
    user.passwordHash = await bcrypt.hash('correct-password', 4);
    userRepo = {
      findOne: jest.fn().mockResolvedValue(user),
      save: jest.fn(),
    };
    otpRepo = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      save: jest.fn(async (value: any) => value),
      findOne: jest.fn(),
    };
    jwtService = {
      signAsync: jest.fn(async (payload: any) =>
        payload.purpose === 'admin_2fa' ? 'challenge-token' : 'access-token'),
      verifyAsync: jest.fn().mockResolvedValue({ sub: user.id, purpose: 'admin_2fa' }),
    };
    mailService = {
      sendAdminLoginCode: jest.fn().mockResolvedValue(undefined),
    };
    const config = {
      get: jest.fn((key: string, fallback?: string) => ({
        ADMIN_2FA_ENABLED: 'true',
        NODE_ENV: 'production',
      }[key] ?? fallback)),
    };
    service = new AuthService(userRepo, otpRepo, jwtService, config as any, mailService);
  });

  it('does not issue an admin access token after password validation alone', async () => {
    const result: any = await service.login(user.email, 'correct-password');

    expect(result).toEqual(expect.objectContaining({
      requires_2fa: true,
      challenge: 'challenge-token',
    }));
    expect(result.access_token).toBeUndefined();
    expect(mailService.sendAdminLoginCode).toHaveBeenCalledTimes(1);
    expect(otpRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      type: 'admin_login',
      email: user.email,
    }));
  });

  it('issues the access token and consumes the OTP after valid verification', async () => {
    const otp = {
      email: user.email,
      code: await bcrypt.hash('123456', 4),
      type: 'admin_login',
      usedAt: null,
      expiresAt: new Date(Date.now() + 60000),
    };
    otpRepo.findOne.mockResolvedValue(otp);

    const result = await service.verifyAdminLogin('challenge-token', '123456');

    expect(result.access_token).toBe('access-token');
    expect(otp.usedAt).toBeInstanceOf(Date);
    expect(otpRepo.save).toHaveBeenCalledWith(otp);
  });
});
