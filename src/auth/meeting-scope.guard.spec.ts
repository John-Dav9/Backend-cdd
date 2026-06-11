import { ForbiddenException } from '@nestjs/common';
import { MeetingScopeGuard } from './meeting-scope.guard';

describe('MeetingScopeGuard', () => {
  const guard = new MeetingScopeGuard();
  const context = (user: any, id: string) => ({
    switchToHttp: () => ({
      getRequest: () => ({ user, params: { id }, body: {} }),
    }),
  }) as any;

  it('allows a scoped moderator into the invited meeting', () => {
    expect(guard.canActivate(context({
      role: 'meeting_moderator',
      meetingModeratorFor: 'meeting-a',
    }, 'meeting-a'))).toBe(true);
  });

  it('blocks the same link from another meeting', () => {
    expect(() => guard.canActivate(context({
      role: 'meeting_moderator',
      meetingModeratorFor: 'meeting-a',
    }, 'meeting-b'))).toThrow(ForbiddenException);
  });

  it('does not restrict global administrators', () => {
    expect(guard.canActivate(context({ role: 'admin' }, 'meeting-b'))).toBe(true);
  });

  it('allows a visitor token only into its private meeting', () => {
    expect(guard.canActivate(context({
      role: 'visitor',
      meetingAccessFor: 'meeting-a',
    }, 'meeting-a'))).toBe(true);

    expect(() => guard.canActivate(context({
      role: 'visitor',
      meetingAccessFor: 'meeting-a',
    }, 'meeting-b'))).toThrow(ForbiddenException);
  });
});
