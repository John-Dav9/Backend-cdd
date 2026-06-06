import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ActualitesModule } from './actualites/actualites.module';
import { AnnoncesModule } from './annonces/annonces.module';
import { AuthModule } from './auth/auth.module';
import { BibliothequeModule } from './bibliotheque/bibliotheque.module';
import { ChatModule } from './chat/chat.module';
import { ContactModule } from './contact/contact.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { InscriptionsModule } from './inscriptions/inscriptions.module';
import { MailModule } from './mail/mail.module';
import { MarathonModule } from './marathon/marathon.module';
import { MessagesModule } from './messages/messages.module';
import { NewsletterModule } from './newsletter/newsletter.module';
import { PagesModule } from './pages/pages.module';
import { PrieresModule } from './prieres/prieres.module';
import { SettingsModule } from './settings/settings.module';
import { StorageModule } from './storage/storage.module';
import { TemoignagesModule } from './temoignages/temoignages.module';
import { UserModule } from './user/user.module';
import { MembresModule } from './membres/membres.module';
import { ReplaysModule } from './replays/replays.module';
import { ReunionsModule } from './reunions/reunions.module';
import { StreamingModule } from './streaming/streaming.module';
import { BibleModule } from './bible/bible.module';
import { AuditModule } from './audit/audit.module';
import { CellGroupsModule } from './cell-groups/cell-groups.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60, limit: 120 }]),
    ScheduleModule.forRoot(),
    DatabaseModule,
    StorageModule,
    AuthModule,
    MailModule,
    HealthModule,
    InscriptionsModule,
    AnnoncesModule,
    ActualitesModule,
    BibliothequeModule,
    TemoignagesModule,
    SettingsModule,
    PagesModule,
    MessagesModule,
    ContactModule,
    MarathonModule,
    PrieresModule,
    NewsletterModule,
    ChatModule,
    UserModule,
    MembresModule,
    ReplaysModule,
    ReunionsModule,
    StreamingModule,
    BibleModule,
    AuditModule,
    CellGroupsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
