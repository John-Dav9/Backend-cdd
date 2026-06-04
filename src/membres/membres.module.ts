import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommunitySettings } from '../database/entities/community-settings.entity';
import { MarathonInscription } from '../database/entities/marathon-inscription.entity';
import { Member } from '../database/entities/member.entity';
import { NewsletterSubscriber } from '../database/entities/newsletter-subscriber.entity';
import { MembresController } from './membres.controller';
import { MembresService } from './membres.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Member, MarathonInscription, NewsletterSubscriber, CommunitySettings]),
  ],
  controllers: [MembresController],
  providers: [MembresService],
  exports: [MembresService],
})
export class MembresModule {}
