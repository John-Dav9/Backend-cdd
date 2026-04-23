import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateActualiteDto {
  @IsNotEmpty()
  @IsString()
  titre: string;

  @IsNotEmpty()
  @IsString()
  contenu: string;

  @IsOptional()
  @IsString()
  auteur?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  videoId?: string;

  @IsOptional()
  @IsString()
  tags?: string;

  @IsOptional()
  @IsBoolean()
  publiee?: boolean;
}
