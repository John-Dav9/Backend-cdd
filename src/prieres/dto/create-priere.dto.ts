import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePriereDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  prenom?: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  sujet: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(5000)
  message: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsBoolean()
  anonyme?: boolean;
}
