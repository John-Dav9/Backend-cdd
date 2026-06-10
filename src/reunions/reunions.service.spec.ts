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
  let service: ReunionsService;
  let jitsiService: any;

  beforeEach(() => {
    participant = null;
    const meetingRepo = {
      findOne: jest.fn().mockImplementation(async () => meeting),
      save: jest.fn(async (value: any) => Object.assign(meeting, value)),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const participantRepo = {
      findOne: jest.fn().mockImplementation(async ({ where }: any) => {
        if (!participant) return null;
        if (where.id && where.id !== participant.id) return null;
        if (where.admissionStatus && where.admissionStatus !== participant.admissionStatus) return null;
        return Object.assign(participant, { member });
      }),
      save: jest.fn().mockImplementation(async (value: any) => {
        participant = Object.assign(participant ?? { id: 'participant-id' }, value);
        return participant;
      }),
      count: jest.fn().mockResolvedValue(1),
    };
    const memberRepo = {
      findOne: jest.fn().mockResolvedValue(member),
    };
    jitsiService = {
      generateToken: jest.fn().mockReturnValue('jitsi-token'),
      getJitsiUrl: jest.fn().mockReturnValue('https://meet.example.test'),
    };
    service = new ReunionsService(
      meetingRepo as any,
      participantRepo as any,
      memberRepo as any,
      jitsiService,
      {} as any,
      { save: jest.fn() } as any,
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
});
