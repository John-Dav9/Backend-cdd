import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Public } from '../auth/public.decorator';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  // ── Theme (public read, admin write) ──────────────────
  @Public()
  @Get('theme')
  getTheme() {
    return this.service.getTheme();
  }

  @Patch('theme')
  updateTheme(@Body() data: Record<string, any>) {
    return this.service.updateTheme(data);
  }

  @Post('theme/image/:field')
  @UseInterceptors(FileInterceptor('file'))
  uploadThemeImage(
    @Param('field') field: 'logoUrl' | 'heroImageUrl',
    @UploadedFile() file: any,
  ) {
    return this.service.uploadThemeImage(field, file);
  }

  // ── Cultes (public read, admin write) ────────────────
  @Public()
  @Get('cultes')
  getCultes() {
    return this.service.getCultes();
  }

  @Patch('cultes')
  updateCultes(@Body('items') items: any[]) {
    return this.service.updateCultes(items);
  }

  // ── Prochain culte présentiel ──────────────────────
  @Public()
  @Get('next-culte')
  getNextCulte() {
    return this.service.getNextCulte();
  }

  @Patch('next-culte')
  updateNextCulte(@Body() data: { sujet: string; date: string; message: string }) {
    return this.service.updateNextCulte(data);
  }

  @Post('next-culte/flyer')
  @UseInterceptors(FileInterceptor('file'))
  uploadNextCulteFlyer(@UploadedFile() file: any) {
    return this.service.uploadNextCulteFlyer(file);
  }

  @Post('next-culte/broadcast')
  broadcastNextCulte() {
    return this.service.broadcastNextCulte();
  }

  // ── Pages (public read, admin write) ──────────────────
  @Public()
  @Get('pages/:pageId')
  getPage(@Param('pageId') pageId: string) {
    return this.service.getPage(pageId);
  }

  @Patch('pages/:pageId')
  updatePage(@Param('pageId') pageId: string, @Body() data: Record<string, any>) {
    return this.service.updatePage(pageId, data);
  }

  @Post('pages/:pageId/image/:field')
  @UseInterceptors(FileInterceptor('file'))
  uploadPageImage(
    @Param('pageId') pageId: string,
    @Param('field') field: string,
    @UploadedFile() file: any,
  ) {
    return this.service.uploadPageImage(pageId, field, file);
  }
}
