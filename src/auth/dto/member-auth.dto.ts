import { IsEmail, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class CheckEmailDto {
  @IsEmail()
  email: string;
}

export class SendOtpDto {
  @IsEmail()
  email: string;
}

export class VerifyOtpDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(4, 6)
  code: string;
}

export class VerifyMagicLinkDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsOptional()
  city?: string;
}

export class GuestAccessDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  displayName: string;
}
