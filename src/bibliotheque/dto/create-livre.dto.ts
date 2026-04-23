import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateLivreDto {
  @IsNotEmpty()
  @IsString()
  titre: string;

  @IsOptional()
  @IsString()
  auteur?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  categorie?: string;
}
