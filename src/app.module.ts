import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ActualitesModule } from './actualites/actualites.module';
import { AnnoncesModule } from './annonces/annonces.module';
import { AuthModule } from './auth/auth.module';
import { BibliothequeModule } from './bibliotheque/bibliotheque.module';
import { ContactModule } from './contact/contact.module';
import { FirebaseModule } from './firebase/firebase.module';
import { InscriptionsModule } from './inscriptions/inscriptions.module';
import { MailModule } from './mail/mail.module';
import { MarathonModule } from './marathon/marathon.module';
import { MessagesModule } from './messages/messages.module';
import { PagesModule } from './pages/pages.module';
import { UserModule } from './user/user.module';
import { TemoignagesModule } from './temoignages/temoignages.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: 60,
        limit: 120,
      },
    ]),
    ScheduleModule.forRoot(),
    FirebaseModule,
    AuthModule,
    MailModule,
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
    UserModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
