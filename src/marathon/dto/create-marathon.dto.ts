import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export enum MarathonScope {
  BIBLE_COMPLETE      = 'BIBLE_COMPLETE',
  ANCIEN_TESTAMENT    = 'ANCIEN_TESTAMENT',
  NOUVEAU_TESTAMENT   = 'NOUVEAU_TESTAMENT',
  LIVRES_CHOISIS      = 'LIVRES_CHOISIS',
}

export enum MarathonStatut {
  PLANIFIE = 'PLANIFIE',
  ACTIF    = 'ACTIF',
  ARCHIVE  = 'ARCHIVE',
}

export class CreateMarathonDto {
  @IsString()
  @MinLength(3)
  titre: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  dateDebut: string;

  @IsDateString()
  dateFin: string;

  @IsEnum(MarathonScope)
  scope: MarathonScope;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  livresChoisis?: string[]; // IDs from BIBLE_BOOKS (required when scope = LIVRES_CHOISIS)
}
