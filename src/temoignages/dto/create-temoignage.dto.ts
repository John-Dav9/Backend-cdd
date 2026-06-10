import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTemoignageDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(150)
  nom: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ville?: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(20)
  @MaxLength(5000)
  contenu: string;
}
