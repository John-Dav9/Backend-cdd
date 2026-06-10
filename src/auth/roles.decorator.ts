import { SetMetadata } from '@nestjs/common';
import { MemberRole } from '../database/entities/member.entity';

export const ROLES_KEY = 'roles';
export type AppRole = MemberRole | 'user' | 'meeting_moderator';

export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);
export const AdminOnly = () => Roles('admin', 'super_admin');
export const MeetingAdminOnly = () => Roles('meeting_moderator', 'admin', 'super_admin');
