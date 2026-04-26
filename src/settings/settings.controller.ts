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
import { Public } from '../auth/public.decorator';
import { SettingsService } from './settings.service';
import { MailService } from '../mail/mail.service';

@Controller('settings')
export class SettingsController {
  constructor(
    private readonly service: SettingsService,
    private readonly mail: MailService,
  ) {}

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

  // ── Email templates (admin only) ──────────────────────
  @Get('email-templates')
  listEmailTemplates() {
    return this.mail.listTemplates();
  }

  @Get('email-templates/:key')
  getEmailTemplate(@Param('key') key: string) {
    return this.mail.getTemplateForAdmin(key);
  }

  @Patch('email-templates/:key')
  saveEmailTemplate(
    @Param('key') key: string,
    @Body() body: { subject: string; body: string },
  ) {
    return this.mail.saveTemplate(key, body.subject, body.body);
  }

  @Delete('email-templates/:key')
  resetEmailTemplate(@Param('key') key: string) {
    return this.mail.resetTemplate(key);
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
