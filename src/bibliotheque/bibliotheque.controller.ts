import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Public } from '../auth/public.decorator';
import { BibliothequeService } from './bibliotheque.service';
import { CreateLivreDto } from './dto/create-livre.dto';

@Controller('bibliotheque')
export class BibliothequeController {
  constructor(private readonly service: BibliothequeService) {}

  @Public()
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  // Admin
  @Post()
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'pdf', maxCount: 1 },
      { name: 'cover', maxCount: 1 },
    ]),
  )
  create(
    @Body() dto: CreateLivreDto,
    @UploadedFiles()
    files: { pdf: Express.Multer.File[]; cover?: Express.Multer.File[] },
  ) {
    return this.service.create(dto, files.pdf[0], files.cover?.[0]);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
