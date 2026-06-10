import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

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
  @IsIn(['admin', 'member', 'visitor'])
  role: 'admin' | 'member' | 'visitor';
}

export class UpdateSettingsDto {
  @IsBoolean()
  isOpen: boolean;
}
