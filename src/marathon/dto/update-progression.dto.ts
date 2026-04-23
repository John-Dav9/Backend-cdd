import { IsEmail, IsNumber, IsBoolean } from 'class-validator';

export class UpdateProgressionDto {
  @IsEmail()
  email: string;

  @IsNumber()
  day: number;

  @IsBoolean()
  checked: boolean;
}
