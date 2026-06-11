import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminOnly } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';
import { MeetingBackgroundsService } from './meeting-backgrounds.service';

@Controller('meeting-backgrounds')
export class MeetingBackgroundsController {
  constructor(private readonly service: MeetingBackgroundsService) {}

  @Public()
  @Get()
  findPublic() {
    return this.service.findPublic();
  }

  @AdminOnly()
  @Get('admin/all')
  findAll() {
    return this.service.findAll();
  }

  @AdminOnly()
  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024 } }))
  create(@Body() body: any, @UploadedFile() file?: Express.Multer.File) {
    return this.service.create(body, file);
  }

  @AdminOnly()
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @AdminOnly()
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
