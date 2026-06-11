import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class MeetingScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const scopedMeetingId =
      request.user?.role === 'meeting_moderator'
        ? request.user.meetingModeratorFor
        : request.user?.meetingAccessFor;
    if (!scopedMeetingId) return true;

    const requestedMeetingId =
      request.params?.id ??
      request.params?.meetingId ??
      request.body?.meetingId;
    if (requestedMeetingId && scopedMeetingId === requestedMeetingId) return true;
    throw new ForbiddenException('Ce lien est limité à une seule réunion.');
  }
}
