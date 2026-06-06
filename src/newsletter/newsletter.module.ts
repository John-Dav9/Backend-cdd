import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Actualite } from '../database/entities/actualite.entity';
import { Meeting } from '../database/entities/meeting.entity';
import { NewsletterSubscriber } from '../database/entities/newsletter-subscriber.entity';
import { MailModule } from '../mail/mail.module';
import { NewsletterController } from './newsletter.controller';
import { NewsletterScheduler } from './newsletter.scheduler';
import { NewsletterService } from './newsletter.service';

@Module({
  imports: [TypeOrmModule.forFeature([NewsletterSubscriber, Actualite, Meeting]), MailModule],
  controllers: [NewsletterController],
  providers: [NewsletterService, NewsletterScheduler],
  exports: [NewsletterService],
})
export class NewsletterModule {}
