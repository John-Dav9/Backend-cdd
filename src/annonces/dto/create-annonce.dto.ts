import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAnnonceDto {
  @IsNotEmpty()
  @IsString()
  titre: string;

  @IsNotEmpty()
  @IsString()
  contenu: string;

  @IsOptional()
  @IsBoolean()
  publiee?: boolean;

  // Si true, envoie un mail à tous les inscrits
  @IsOptional()
  @IsBoolean()
  envoyerEmail?: boolean;
}
