import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Marathon } from '../database/entities/marathon.entity';
import { MarathonInscription } from '../database/entities/marathon-inscription.entity';
import { MailModule } from '../mail/mail.module';
import { MarathonController } from './marathon.controller';
import { MarathonService } from './marathon.service';

@Module({
  imports: [TypeOrmModule.forFeature([Marathon, MarathonInscription]), MailModule],
  controllers: [MarathonController],
  providers: [MarathonService],
  exports: [MarathonService],
})
export class MarathonModule {}
