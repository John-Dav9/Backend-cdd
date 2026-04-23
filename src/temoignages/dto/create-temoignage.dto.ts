import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateTemoignageDto {
  @IsNotEmpty()
  @IsString()
  nom: string;

  @IsOptional()
  @IsString()
  ville?: string;

  @IsNotEmpty()
  @IsString()
  contenu: string;
}
