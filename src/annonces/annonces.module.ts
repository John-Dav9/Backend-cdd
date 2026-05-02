import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Annonce } from '../database/entities/annonce.entity';
import { Inscription } from '../database/entities/inscription.entity';
import { MarathonInscription } from '../database/entities/marathon-inscription.entity';
import { MailModule } from '../mail/mail.module';
import { AnnoncesController } from './annonces.controller';
import { AnnoncesService } from './annonces.service';

@Module({
  imports: [TypeOrmModule.forFeature([Annonce, Inscription, MarathonInscription]), MailModule],
  controllers: [AnnoncesController],
  providers: [AnnoncesService],
})
export class AnnoncesModule {}
