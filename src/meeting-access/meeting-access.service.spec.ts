import { MeetingAccessService } from './meeting-access.service';

describe('MeetingAccessService', () => {
  it('issues a meeting-scoped visitor session without creating a member', async () => {
    const meeting = { id: 'meeting-id', status: 'scheduled' };
    const accessRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'link-id',
        meetingId: meeting.id,
        meeting,
        tokenHash: await require('bcryptjs').hash('secret', 4),
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
        maxUses: 2,
        useCount: 0,
      }),
      save: jest.fn(async value => value),
    };
    const jwtService = { signAsync: jest.fn().mockResolvedValue('visitor-token') };
    const service = new MeetingAccessService(
      accessRepo as any,
      {} as any,
      jwtService as any,
    );

    const result = await service.accept('link-id.secret', 'Pascal Jolly');

    expect(result.access_token).toBe('visitor-token');
    expect(result.meetingId).toBe(meeting.id);
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'visitor',
        type: 'visitor',
        meetingAccessFor: meeting.id,
      }),
      { expiresIn: '12h' },
    );
    expect(accessRepo.save).toHaveBeenCalledWith(expect.objectContaining({ useCount: 1 }));
  });
});
