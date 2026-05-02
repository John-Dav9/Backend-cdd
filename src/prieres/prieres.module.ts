import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Priere } from '../database/entities/priere.entity';
import { MailModule } from '../mail/mail.module';
import { PrieresController } from './prieres.controller';
import { PrieresService } from './prieres.service';

@Module({
  imports: [TypeOrmModule.forFeature([Priere]), MailModule],
  controllers: [PrieresController],
  providers: [PrieresService],
})
export class PrieresModule {}
