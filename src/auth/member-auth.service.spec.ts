import { MemberAuthService } from './member-auth.service';

describe('MemberAuthService guest access', () => {
  it('creates an ephemeral visitor without writing a member record', async () => {
    const memberRepo = {
      save: jest.fn(),
      findOne: jest.fn(),
    };
    const jwtService = {
      signAsync: jest.fn().mockResolvedValue('visitor-token'),
    };
    const service = new MemberAuthService(
      memberRepo as any,
      {} as any,
      {} as any,
      jwtService as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await service.createGuest({ displayName: 'Marie Test' });

    expect(memberRepo.save).not.toHaveBeenCalled();
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'visitor', type: 'visitor', name: 'Marie Test' }),
      { expiresIn: '12h' },
    );
    expect(result.member).toEqual(expect.objectContaining({
      firstName: 'Marie',
      lastName: 'Test',
      role: 'visitor',
    }));
  });
});
