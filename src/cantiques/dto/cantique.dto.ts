import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SaveCantiqueDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  author?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(30000)
  lyrics: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  source?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  rightsNote?: string;
}
