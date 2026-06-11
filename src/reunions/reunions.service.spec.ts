jest.mock('../mail/mail.service', () => ({
  MailService: class MailService {},
}));

import { ReunionsService } from './reunions.service';

describe('ReunionsService waiting room', () => {
  const meeting = {
    id: 'meeting-id',
    title: 'Réunion test',
    status: 'scheduled',
    lobbyEnabled: true,
    jitsiRoomId: 'room-id',
  } as any;
  const member = {
    id: 'member-id',
    firstName: 'Jean',
    lastName: 'Test',
    email: 'jean@example.test',
    role: 'member',
  } as any;

  let participant: any;
  let invite: any;
  let service: ReunionsService;
  let jitsiService: any;
  let inviteRepo: any;
  let jwtService: any;

  beforeEach(() => {
    participant = null;
    invite = null;
    const meetingRepo = {
      findOne: jest.fn().mockImplementation(async () => meeting),
      save: jest.fn(async (value: any) => Object.assign(meeting, value)),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const participantRepo = {
      findOne: jest.fn().mockImplementation(async ({ where }: any) => {
        if (!participant) return null;
        if (where.id && where.id !== participant.id) return null;
        if (where.memberId && where.memberId !== participant.memberId) return null;
        if (where.authSubject && where.authSubject !== participant.authSubject) return null;
        if (where.admissionStatus && where.admissionStatus !== participant.admissionStatus) return null;
        return Object.assign(participant, { member });
      }),
      find: jest.fn().mockImplementation(async () => participant ? [participant] : []),
      save: jest.fn().mockImplementation(async (value: any) => {
        participant = Object.assign(participant ?? { id: 'participant-id' }, value);
        return participant;
      }),
      count: jest.fn().mockResolvedValue(1),
    };
    const memberRepo = {
      findOne: jest.fn().mockImplementation(async ({ where }: any) =>
        where.id === member.id ? member : null),
    };
    inviteRepo = {
      save: jest.fn().mockImplementation(async (value: any) => {
        invite = Object.assign(invite ?? { id: 'invite-id' }, value);
        return invite;
      }),
      findOne: jest.fn().mockImplementation(async ({ where }: any) =>
        invite?.id === where.id ? invite : null),
    };
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('scoped-access-token'),
    };
    jitsiService = {
      generateToken: jest.fn().mockReturnValue('jitsi-token'),
      getJitsiUrl: jest.fn().mockReturnValue('https://meet.example.test'),
      getDialIn: jest.fn().mockReturnValue(null),
    };
    service = new ReunionsService(
      meetingRepo as any,
      participantRepo as any,
      inviteRepo,
      memberRepo as any,
      jitsiService,
      {} as any,
      { save: jest.fn() } as any,
      jwtService,
    );
  });

  it('issues a revocable moderator token scoped to one meeting', async () => {
    const created: any = await service.createModeratorInvite(meeting.id, member.id);

    expect(created.token).toMatch(/^invite-id\./);
    expect(invite.tokenHash).not.toContain(created.token.split('.')[1]);

    const accepted: any = await service.acceptModeratorInvite(created.token);

    expect(accepted.access_token).toBe('scoped-access-token');
    expect(accepted.meetingId).toBe(meeting.id);
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: member.id,
        role: 'meeting_moderator',
        meetingModeratorFor: meeting.id,
      }),
      { expiresIn: '12h' },
    );
  });

  it('withholds Jitsi credentials until an administrator admits the member', async () => {
    const pending: any = await service.join(
      meeting.id,
      member.id,
      {},
      { sub: member.id, type: 'member', role: 'member' },
    );

    expect(pending.waitingRoom).toBe(true);
    expect(pending.jitsiToken).toBeUndefined();
    expect(jitsiService.generateToken).not.toHaveBeenCalled();

    await service.admitParticipant(meeting.id, pending.participantId);
    const admitted: any = await service.getAdmissionStatus(
      meeting.id,
      pending.participantId,
      { sub: member.id, type: 'member', role: 'member' },
    );

    expect(admitted.jitsiToken).toBe('jitsi-token');
    expect(admitted.roomId).toBe(meeting.jitsiRoomId);
    expect(jitsiService.generateToken).toHaveBeenCalledTimes(1);
  });

  it('uses the primary administrator identity instead of a cached member identity', async () => {
    const admitted: any = await service.join(
      meeting.id,
      'admin-id',
      {},
      {
        sub: 'admin-id',
        email: 'admin@cmciea-france.com',
        name: 'Administrateur principal',
        role: 'super_admin',
      },
    );

    expect(admitted.isModerator).toBe(true);
    expect(admitted.displayName).toBe('Administrateur principal');
    expect(admitted.email).toBe('admin@cmciea-france.com');
    expect(admitted.role).toBe('super_admin');
    expect(participant.authSubject).toBe('admin-id');
    expect(jitsiService.generateToken).toHaveBeenCalledWith(
      meeting.jitsiRoomId,
      expect.objectContaining({
        firstName: 'Administrateur',
        lastName: 'principal',
        email: 'admin@cmciea-france.com',
        role: 'super_admin',
      }),
      true,
    );
  });

  it('reuses the same participation when the primary administrator reconnects', async () => {
    const jwtUser = {
      sub: 'admin-id',
      email: 'admin@cmciea-france.com',
      name: 'Administrateur principal',
      role: 'super_admin',
    };

    const first: any = await service.join(meeting.id, 'admin-id', {}, jwtUser);
    const second: any = await service.join(meeting.id, 'admin-id', {}, jwtUser);

    expect(second.participantId).toBe(first.participantId);
    expect(participant.authSubject).toBe('admin-id');
  });
});
