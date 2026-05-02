import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Actualite } from '../database/entities/actualite.entity';
import { EmailTemplate } from '../database/entities/email-template.entity';
import { Inscription } from '../database/entities/inscription.entity';
import { MarathonInscription } from '../database/entities/marathon-inscription.entity';
import { Setting } from '../database/entities/setting.entity';
import { MailModule } from '../mail/mail.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [TypeOrmModule.forFeature([Setting, EmailTemplate, MarathonInscription, Inscription, Actualite]), MailModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
