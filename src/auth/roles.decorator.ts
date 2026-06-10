import { SetMetadata } from '@nestjs/common';
import { MemberRole } from '../database/entities/member.entity';

export const ROLES_KEY = 'roles';
export type AppRole = MemberRole | 'user';

export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);
export const AdminOnly = () => Roles('admin', 'super_admin');
