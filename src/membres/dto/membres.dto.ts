import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { MemberRole } from '../../database/entities/member.entity';

export class UpdateMembreDto {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  city?: string;
}

export class UpdateRoleDto {
  @IsEnum(['super_admin', 'admin', 'member', 'visitor'])
  role: MemberRole;
}

export class UpdateSettingsDto {
  @IsBoolean()
  isOpen: boolean;
}
