import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum InscriptionType {
  MARATHON = 'MARATHON',
  CULTE = 'CULTE',
  LECTURE_BIBLIQUE = 'LECTURE_BIBLIQUE',
}

export class CreateInscriptionDto {
  @IsEnum(InscriptionType)
  type: InscriptionType;

  @IsNotEmpty()
  @IsString()
  nom: string;

  @IsNotEmpty()
  @IsString()
  prenom: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  telephone?: string;

  // Pour CULTE
  @IsOptional()
  @IsString()
  dateCulte?: string;

  // Pour LECTURE_BIBLIQUE
  @IsOptional()
  @IsString()
  pseudoTelegram?: string;
}
