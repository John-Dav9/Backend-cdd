import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateReunionDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  startTime: string;

  @IsDateString()
  @IsOptional()
  endTime?: string;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @IsBoolean()
  @IsOptional()
  isRecurring?: boolean;

  @IsString()
  @IsOptional()
  recurrenceRule?: string;

  @IsBoolean()
  @IsOptional()
  lobbyEnabled?: boolean;
}

export class UpdateReunionDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  @IsOptional()
  startTime?: string;

  @IsDateString()
  @IsOptional()
  endTime?: string;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @IsEnum(['scheduled', 'live', 'ended', 'cancelled'])
  @IsOptional()
  status?: string;

  @IsBoolean()
  @IsOptional()
  isRecurring?: boolean;

  @IsString()
  @IsOptional()
  recurrenceRule?: string;

  @IsBoolean()
  @IsOptional()
  lobbyEnabled?: boolean;
}

export class JoinReunionDto {
  @IsString()
  @IsOptional()
  displayName?: string;
}

export class AdmissionStatusDto {
  @IsUUID()
  participantId: string;
}
