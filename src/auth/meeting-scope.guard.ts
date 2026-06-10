import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class MeetingScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (request.user?.role !== 'meeting_moderator') return true;

    const requestedMeetingId =
      request.params?.id ??
      request.params?.meetingId ??
      request.body?.meetingId;
    if (requestedMeetingId && request.user.meetingModeratorFor === requestedMeetingId) return true;
    throw new ForbiddenException('Ce lien est limité à une seule réunion.');
  }
}
