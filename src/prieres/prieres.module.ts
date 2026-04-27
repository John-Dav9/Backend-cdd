import { Module } from '@nestjs/common';
import { FirebaseModule } from '../firebase/firebase.module';
import { MailModule } from '../mail/mail.module';
import { PrieresController } from './prieres.controller';
import { PrieresService } from './prieres.service';

@Module({
  imports: [FirebaseModule, MailModule],
  controllers: [PrieresController],
  providers: [PrieresService],
})
export class PrieresModule {}
